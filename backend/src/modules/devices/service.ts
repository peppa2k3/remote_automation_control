import { randomBytes } from 'node:crypto';
import {
  DEVICE_SCOPES,
  DEVICE_OFFLINE_MS,
  HEARTBEAT_SECONDS,
  deviceSchema,
  runtimeSchema,
  type HeartbeatInput,
  type AgentMetadata,
  type DeviceIdentity,
} from '@automation/contracts';
import type { PrismaClient, Prisma } from '../../generated/prisma/client.js';
import { AuthError } from '../auth/types.js';
import { digest } from '../auth/crypto.js';
import { createAuthStore } from '../auth/store.js';

export const deviceHash = (token: string) => digest(`automation.device.v1:${token}`);
export const pairHash = (code: string) => digest(`automation.pair.v1:${code}`);
const credentialMs = 24 * 60 * 60 * 1000;
const pendingMs = 5 * 60 * 1000;
const denied = () =>
  new AuthError(
    401,
    'DEVICE_AUTH_REQUIRED',
    'Credential thiết bị không hợp lệ hoặc đã bị thu hồi.',
  );

export class DeviceService {
  private readonly startedAt: Date;
  constructor(
    readonly db: PrismaClient,
    private readonly clock = () => new Date(),
  ) {
    this.startedAt = this.clock();
  }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`device:${id}`}, 0))`;
  }
  private async credential(
    tx: Prisma.TransactionClient | PrismaClient,
    hash: string,
    pending = false,
  ) {
    const now = this.clock();
    const record = await tx.deviceCredential.findUnique({
      where: { tokenHash: hash },
      include: { device: true },
    });
    if (
      !record ||
      record.revokedAt ||
      record.device.revokedAt ||
      record.expiresAt <= now ||
      (!record.activatedAt &&
        (!pending || !record.pendingExpiresAt || record.pendingExpiresAt <= now))
    )
      throw denied();
    return record;
  }
  private identity(record: {
    deviceId: string;
    scopes: string[];
    expiresAt: Date;
  }): DeviceIdentity {
    return {
      deviceId: record.deviceId,
      scopes: record.scopes as DeviceIdentity['scopes'],
      credentialExpiresAt: record.expiresAt.toISOString(),
    };
  }
  async createCode(ownerId: string, requestId: string) {
    const now = this.clock();
    if (
      !(await createAuthStore(this.db).consumeAttempts(
        [{ key: digest(`pair.mint:${ownerId}`), limit: 5 }],
        now,
        900,
      ))
    )
      throw new AuthError(429, 'PAIR_RATE_LIMITED', 'Đã vượt giới hạn tạo mã ghép đôi.');
    const code = `pair_${randomBytes(32).toString('hex')}`,
      expiresAt = new Date(now.getTime() + pendingMs);
    await this.db.$transaction(async (tx) => {
      const record = await tx.pairingCode.create({
        data: { codeHash: pairHash(code), createdBy: ownerId, expiresAt },
      });
      await tx.auditLog.create({
        data: { actorId: ownerId, targetId: record.id, action: 'device.pairing_code', requestId },
      });
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }
  async pair(
    input: AgentMetadata & { code: string; label: string },
    ip: string,
    requestId: string,
  ) {
    const now = this.clock();
    if (
      !(await createAuthStore(this.db).consumeAttempts(
        [{ key: digest(`pair.ip:${ip}`), limit: 10 }],
        now,
        900,
      ))
    )
      throw new AuthError(429, 'PAIR_RATE_LIMITED', 'Đã vượt giới hạn ghép đôi.');
    const token = `agt_${randomBytes(32).toString('hex')}`;
    return this.db.$transaction(async (tx) => {
      const hash = pairHash(input.code);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pair:${hash}`}, 0))`;
      const code = await tx.pairingCode.findUnique({
        where: { codeHash: hash },
        include: { owner: true },
      });
      if (
        !code ||
        code.usedAt ||
        code.expiresAt <= now ||
        code.owner.status !== 'ACTIVE' ||
        code.owner.mfaEnabled
      )
        throw new AuthError(
          401,
          'PAIR_CODE_INVALID',
          'Mã ghép đôi không hợp lệ, đã dùng hoặc hết hạn.',
        );
      await tx.pairingCode.update({ where: { id: code.id }, data: { usedAt: now } });
      const { label, platform, arch, version, capabilities } = input;
      const device = await tx.device.create({
        data: { label, platform, arch, version, capabilities, ownerId: code.createdBy },
      });
      const record = await tx.deviceCredential.create({
        data: {
          deviceId: device.id,
          tokenHash: deviceHash(token),
          scopes: [...DEVICE_SCOPES],
          activatedAt: now,
          expiresAt: new Date(now.getTime() + credentialMs),
        },
      });
      await tx.auditLog.create({
        data: { actorId: code.createdBy, targetId: device.id, action: 'device.pair', requestId },
      });
      return { ...this.identity(record), token };
    });
  }
  async authenticate(token: string, scope: (typeof DEVICE_SCOPES)[number], pending = false) {
    const record = await this.credential(this.db, deviceHash(token), pending);
    if (!record.scopes.includes(scope))
      throw new AuthError(403, 'DEVICE_SCOPE_REQUIRED', 'Credential không có quyền này.');
    return record;
  }
  async heartbeat(token: string, metadata: HeartbeatInput) {
    const auth = await this.authenticate(token, 'agent:heartbeat');
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, auth.deviceId);
      const record = await this.credential(tx, deviceHash(token));
      const now = this.clock();
      if (
        !record.device.lastSeenAt ||
        record.device.lastSeenAt < this.startedAt ||
        now.getTime() - record.device.lastSeenAt.getTime() >= DEVICE_OFFLINE_MS
      )
        await tx.auditLog.create({
          data: {
            targetId: auth.deviceId,
            action: 'device.online',
            requestId: crypto.randomUUID(),
          },
        });
      await tx.device.update({
        where: { id: auth.deviceId },
        data: { ...metadata, lastSeenAt: now },
      });
      return {
        deviceId: auth.deviceId,
        serverTime: now.toISOString(),
        heartbeatAfterSeconds: HEARTBEAT_SECONDS,
      };
    });
  }
  async stageRotation(token: string, nextToken: string, requestId: string) {
    if (token === nextToken)
      throw new AuthError(400, 'INVALID_INPUT', 'Credential mới phải khác credential hiện tại.');
    const auth = await this.authenticate(token, 'agent:rotate');
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, auth.deviceId);
      const old = await this.credential(tx, deviceHash(token));
      const now = this.clock(),
        hash = deviceHash(nextToken);
      const previous = await tx.deviceCredential.findUnique({
        where: { rotationParentId: old.id },
      });
      if (previous && (previous.tokenHash !== hash || previous.revokedAt || previous.activatedAt))
        throw new AuthError(
          409,
          'ROTATION_CONFLICT',
          'Thiết bị đã có yêu cầu xoay credential khác.',
        );
      const record = previous
        ? await tx.deviceCredential.update({
            where: { id: previous.id },
            data: {
              expiresAt: new Date(now.getTime() + credentialMs),
              pendingExpiresAt: new Date(now.getTime() + pendingMs),
            },
          })
        : await tx.deviceCredential.create({
            data: {
              deviceId: old.deviceId,
              tokenHash: hash,
              rotationParentId: old.id,
              scopes: old.scopes,
              expiresAt: new Date(now.getTime() + credentialMs),
              pendingExpiresAt: new Date(now.getTime() + pendingMs),
            },
          });
      if (!previous)
        await tx.auditLog.create({
          data: { actorId: null, targetId: old.deviceId, action: 'device.rotate.stage', requestId },
        });
      return this.identity(record);
    });
  }
  async commitRotation(token: string, requestId: string) {
    const auth = await this.authenticate(token, 'agent:rotate', true);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, auth.deviceId);
      const next = await this.credential(tx, deviceHash(token), true);
      if (!next.rotationParentId)
        throw new AuthError(409, 'ROTATION_NOT_STAGED', 'Credential chưa được chuẩn bị để xoay.');
      if (next.activatedAt) return this.identity(next); // Lost response: safe, idempotent confirmation.
      const old = await tx.deviceCredential.findUnique({ where: { id: next.rotationParentId } });
      if (!old || old.revokedAt || old.expiresAt <= this.clock() || !old.activatedAt)
        throw denied();
      const now = this.clock();
      await tx.deviceCredential.update({ where: { id: old.id }, data: { revokedAt: now } });
      const activated = await tx.deviceCredential.update({
        where: { id: next.id },
        data: { activatedAt: now, pendingExpiresAt: null },
      });
      await tx.auditLog.create({
        data: { actorId: null, targetId: next.deviceId, action: 'device.rotate.commit', requestId },
      });
      return this.identity(activated);
    });
  }
  async revoke(deviceId: string, ownerId: string, requestId: string) {
    await this.db.$transaction(async (tx) => {
      await this.lock(tx, deviceId);
      const device = await tx.device.findUnique({ where: { id: deviceId } });
      if (!device || device.ownerId !== ownerId)
        throw new AuthError(403, 'DEVICE_OWNER_REQUIRED', 'Chỉ chủ thiết bị được thao tác.');
      if (device.revokedAt) return;
      const now = this.clock();
      await tx.device.update({ where: { id: deviceId }, data: { revokedAt: now } });
      await tx.deviceCredential.updateMany({
        where: { deviceId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditLog.create({
        data: { actorId: ownerId, targetId: deviceId, action: 'device.revoke', requestId },
      });
    });
  }
  async list(userId: string) {
    const now = this.clock();
    const devices = await this.db.device.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: {
        members: { where: { userId }, select: { role: true } },
        credentials: {
          where: { activatedAt: { not: null }, revokedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { tokenHash: true },
        },
      },
    });
    return devices.map((device) =>
      deviceSchema.parse({
        id: device.id,
        label: device.label,
        platform: device.platform,
        arch: device.arch,
        version: device.version,
        capabilities: device.capabilities,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        revokedAt: device.revokedAt?.toISOString() ?? null,
        role: device.ownerId === userId ? 'OWNER' : device.members[0]!.role,
        runtime: runtimeSchema.safeParse(device.runtime).success ? device.runtime : null,
        onlineState: device.revokedAt
          ? 'REVOKED'
          : device.credentials.length &&
              device.lastSeenAt &&
              device.lastSeenAt >= this.startedAt &&
              now.getTime() - device.lastSeenAt.getTime() < DEVICE_OFFLINE_MS
            ? 'ONLINE'
            : 'OFFLINE',
        credentialFingerprint:
          device.ownerId === userId
            ? (device.credentials[0]?.tokenHash.slice(0, 12) ?? null)
            : null,
      }),
    );
  }
  private async access(
    db: Prisma.TransactionClient | PrismaClient,
    deviceId: string,
    userId: string,
    ownerOnly = false,
  ) {
    const device = await db.device.findUnique({
      where: { id: deviceId },
      select: {
        ownerId: true,
        revokedAt: true,
        members: { where: { userId }, select: { userId: true } },
      },
    });
    if (!device || (device.ownerId !== userId && (ownerOnly || !device.members.length)))
      throw new AuthError(403, 'DEVICE_ACCESS_DENIED', 'Bạn không có quyền truy cập thiết bị này.');
    return device;
  }
  async members(deviceId: string, userId: string) {
    await this.access(this.db, deviceId, userId, true);
    const rows = await this.db.deviceMember.findMany({
      where: { deviceId },
      select: { userId: true, role: true, user: { select: { email: true } } },
      orderBy: { userId: 'asc' },
      take: 100,
    });
    return rows.map((row) => ({ userId: row.userId, email: row.user.email, role: row.role }));
  }
  async setMember(
    deviceId: string,
    ownerId: string,
    input: { email: string; role: 'OPERATOR' | 'VIEWER' },
    requestId: string,
  ) {
    await this.db.$transaction(async (tx) => {
      await this.lock(tx, deviceId);
      const device = await this.access(tx, deviceId, ownerId, true);
      if (device.revokedAt) throw new AuthError(409, 'DEVICE_REVOKED', 'Thiết bị đã bị thu hồi.');
      const user = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE')
        throw new AuthError(404, 'USER_NOT_FOUND', 'Tài khoản chưa được tạo hoặc đã khóa.');
      if (user.id === device.ownerId)
        throw new AuthError(400, 'OWNER_ALREADY_MEMBER', 'Chủ thiết bị đã có đầy đủ quyền.');
      await tx.deviceMember.upsert({
        where: { deviceId_userId: { deviceId, userId: user.id } },
        create: { deviceId, userId: user.id, role: input.role },
        update: { role: input.role },
      });
      await tx.auditLog.create({
        data: { actorId: ownerId, targetId: deviceId, action: 'device.member.updated', requestId },
      });
    });
  }
  async removeMember(deviceId: string, ownerId: string, userId: string, requestId: string) {
    await this.db.$transaction(async (tx) => {
      await this.lock(tx, deviceId);
      await this.access(tx, deviceId, ownerId, true);
      await tx.deviceMember.deleteMany({ where: { deviceId, userId } });
      await tx.auditLog.create({
        data: { actorId: ownerId, targetId: deviceId, action: 'device.member.removed', requestId },
      });
    });
  }
  async activity(deviceId: string, userId: string) {
    await this.access(this.db, deviceId, userId);
    const rows = await this.db.auditLog.findMany({
      where: { targetId: deviceId, action: { startsWith: 'device.' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { id: true, action: true, createdAt: true },
    });
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
  }
}
