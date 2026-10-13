import { randomBytes } from 'node:crypto';
import {
  DEVICE_SCOPES,
  deviceSchema,
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
  constructor(
    readonly db: PrismaClient,
    private readonly clock = () => new Date(),
  ) {}
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
    const code = `pair_${randomBytes(16).toString('hex')}`,
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
        code.owner.role !== 'OWNER' ||
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
        data: { label, platform, arch, version, capabilities },
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
  async heartbeat(token: string, metadata: AgentMetadata) {
    const auth = await this.authenticate(token, 'agent:heartbeat');
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, auth.deviceId);
      await this.credential(tx, deviceHash(token));
      const now = this.clock();
      await tx.device.update({
        where: { id: auth.deviceId },
        data: { ...metadata, lastSeenAt: now },
      });
      return { deviceId: auth.deviceId, serverTime: now.toISOString(), heartbeatAfterSeconds: 30 };
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
      if (!device) throw new AuthError(404, 'DEVICE_NOT_FOUND', 'Không tìm thấy thiết bị.');
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
  async list() {
    const now = this.clock();
    const devices = await this.db.device.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: {
        credentials: {
          where: { activatedAt: { not: null }, revokedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' },
          take: 1,
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
        onlineState: device.revokedAt
          ? 'REVOKED'
          : device.credentials.length &&
              device.lastSeenAt &&
              now.getTime() - device.lastSeenAt.getTime() < 90_000
            ? 'ONLINE'
            : 'OFFLINE',
        credentialFingerprint: device.credentials[0]?.tokenHash.slice(0, 12) ?? null,
      }),
    );
  }
}
