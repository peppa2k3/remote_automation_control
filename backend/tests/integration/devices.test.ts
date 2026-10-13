import 'dotenv/config';
import { randomUUID, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../../src/database.js';
import { createApp } from '../../src/app.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { createAuthStore } from '../../src/modules/auth/store.js';
import { digest, hashPassword } from '../../src/modules/auth/crypto.js';
import { DeviceService, deviceHash } from '../../src/modules/devices/service.js';

const enabled = process.env.RUN_DB_TESTS === '1';
const db = enabled ? createDatabase(process.env.DATABASE_URL ?? '') : undefined;
const origin = 'http://localhost:3000',
  ip = '::ffff:127.0.0.1';
const metadata = {
  platform: 'win32',
  arch: 'x64',
  version: '0.1.0',
  capabilities: ['diagnostics', 'heartbeat'],
};
const prefix = `device-test-${randomUUID()}`,
  password = 'Integration-only-password-005!';
let userId: string, viewerId: string, token: string, csrf: string;
let now = new Date();
const logs: unknown[] = [],
  deviceIds: string[] = [],
  codeIds: string[] = [],
  ids: string[] = [];
const service = db ? new DeviceService(db, () => now) : undefined;
const auth = db
  ? new AuthService(createAuthStore(db), {
      sessionSeconds: 1800,
      absoluteSeconds: 28800,
      loginWindowSeconds: 900,
      accountLimit: 100,
      ipLimit: 100,
    })
  : undefined;
const app = createApp({
  frontendOrigin: origin,
  auth,
  devices: service,
  checkDatabase: async () => {},
  rateLimitMax: 1000,
  log: (entry) => logs.push(entry),
});
function mutation(path: string) {
  return request(app)
    .post(`/api/v1/${path}`)
    .set('Origin', origin)
    .set('Cookie', `automation_session=${token}`)
    .set('X-CSRF-Token', csrf)
    .send({});
}
async function pair() {
  if (!db || !service) throw new Error('Explicit test database required');
  const code = await mutation('devices/pairing-code');
  expect(code.status).toBe(200);
  const codes = await db.pairingCode.findMany({ where: { createdBy: userId } });
  codeIds.push(...codes.map((c) => c.id));
  const response = await request(app)
    .post('/api/v1/agent/pair')
    .send({ ...metadata, label: prefix, code: code.body.data.code });
  expect(response.status).toBe(200);
  deviceIds.push(response.body.data.deviceId);
  return response.body.data as { deviceId: string; token: string };
}
describe.skipIf(!enabled)('PostgreSQL device lifecycle and authorization', () => {
  beforeAll(async () => {
    if (!db || !auth) throw new Error('Explicit test database required');
    expect(await db.user.count({ where: { role: 'OWNER' } })).toBe(0);
    const hash = await hashPassword(password);
    const owner = await db.user.create({
      data: { email: `${prefix}@example.test`, passwordHash: hash, role: 'OWNER' },
    });
    userId = owner.id;
    const viewer = await db.user.create({
      data: { email: `${prefix}-viewer@example.test`, passwordHash: hash, role: 'VIEWER' },
    });
    viewerId = viewer.id;
    const id = randomUUID();
    ids.push(id);
    const login = await auth.login({ email: owner.email, password }, 'device-test-owner-ip', id);
    token = login.token;
    csrf = auth.data(login).csrfToken;
  });
  beforeEach(() => {
    now = new Date();
  });
  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: [userId, viewerId].filter(Boolean) } },
          { targetId: { in: [...deviceIds, ...codeIds] } },
          { requestId: { in: ids } },
        ],
      },
    });
    await db.device.deleteMany({ where: { id: { in: deviceIds } } });
    await db.user.deleteMany({ where: { id: { in: [userId, viewerId].filter(Boolean) } } });
    await db.authThrottle.deleteMany({
      where: {
        key: {
          in: [
            digest(`pair.mint:${userId}`),
            digest(`pair.ip:${ip}`),
            digest('login.ip:device-test-owner-ip'),
            digest(`login.account:${prefix}@example.test`),
            digest(`login.account:${prefix}-viewer@example.test`),
          ],
        },
      },
    });
    await db.$disconnect();
  });
  it('expires and atomically consumes codes once, persists hashes, derives online/offline and reconnects', async () => {
    if (!db || !service) throw new Error('No database');
    const expired = await mutation('devices/pairing-code');
    expect(expired.status).toBe(200);
    now = new Date(now.getTime() + 301000);
    expect(
      (
        await request(app)
          .post('/api/v1/agent/pair')
          .send({ ...metadata, code: expired.body.data.code, label: prefix })
      ).status,
    ).toBe(401);
    now = new Date();
    const code = await mutation('devices/pairing-code');
    expect(code.status).toBe(200);
    const results = await Promise.all(
      [0, 1].map(() =>
        request(app)
          .post('/api/v1/agent/pair')
          .send({ ...metadata, code: code.body.data.code, label: prefix }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const paired = results.find((r) => r.status === 200)!.body.data;
    deviceIds.push(paired.deviceId);
    const stored = await db.deviceCredential.findFirstOrThrow({
      where: { deviceId: paired.deviceId },
    });
    expect(stored.tokenHash).toBe(deviceHash(paired.token));
    expect(stored.scopes).toEqual(['agent:heartbeat', 'agent:rotate']);
    expect(JSON.stringify(await service.list())).not.toContain(paired.token);
    expect((await service.list()).find((d) => d.id === paired.deviceId)?.onlineState).toBe(
      'OFFLINE',
    );
    const beat = () =>
      request(app)
        .post('/api/v1/agent/heartbeat')
        .set('Authorization', `Bearer ${paired.token}`)
        .send(metadata);
    expect((await beat()).status).toBe(200);
    expect((await service.list()).find((d) => d.id === paired.deviceId)?.onlineState).toBe(
      'ONLINE',
    );
    now = new Date(now.getTime() + 91000);
    expect((await service.list()).find((d) => d.id === paired.deviceId)?.onlineState).toBe(
      'OFFLINE',
    );
    expect((await beat()).status).toBe(200);
    expect((await service.list()).find((d) => d.id === paired.deviceId)?.onlineState).toBe(
      'ONLINE',
    );
    for (const secret of [paired.token, code.body.data.code, password])
      expect(JSON.stringify(logs)).not.toContain(secret);
  });
  it('separates owner, viewer and device identity; rejects CSRF, extra scopes and native browser Origin', async () => {
    if (!auth || !db) throw new Error('No database');
    expect((await request(app).get('/api/v1/devices')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/devices/pairing-code')
          .set('Cookie', `automation_session=${token}`)
          .set('Origin', origin)
          .send({})
      ).status,
    ).toBe(403);
    const id = randomUUID();
    ids.push(id);
    const viewer = await auth.login(
      { email: `${prefix}-viewer@example.test`, password },
      'device-test-owner-ip',
      id,
    );
    expect(
      (
        await request(app)
          .get('/api/v1/devices')
          .set('Cookie', `automation_session=${viewer.token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/agent/heartbeat')
          .set('Cookie', `automation_session=${token}`)
          .send(metadata)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/agent/heartbeat')
          .set('Authorization', `Bearer ${token}`)
          .send(metadata)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/agent/pair')
          .send({ ...metadata, label: prefix, code: `pair_${'a'.repeat(32)}`, scopes: ['admin'] })
      ).status,
    ).toBe(400);
    const paired = await pair();
    expect(
      (await request(app).get('/api/v1/devices').set('Authorization', `Bearer ${paired.token}`))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/agent/heartbeat')
          .set('Origin', origin)
          .set('Authorization', `Bearer ${paired.token}`)
          .send(metadata)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/agent/jobs/claim')
          .set('Authorization', `Bearer ${paired.token}`)
          .send({})
      ).status,
    ).toBe(404);
    await db.deviceCredential.updateMany({
      where: { deviceId: paired.deviceId },
      data: { scopes: ['agent:rotate'] },
    });
    expect(
      (
        await request(app)
          .post('/api/v1/agent/heartbeat')
          .set('Authorization', `Bearer ${paired.token}`)
          .send(metadata)
      ).status,
    ).toBe(403);
  });
  it('stages/commits rotation idempotently, revokes old tokens and serializes revoke against commit', async () => {
    if (!db || !service) throw new Error('No database');
    const paired = await pair(),
      next = `agt_${randomBytes(32).toString('hex')}`;
    const stage = () =>
      request(app)
        .post('/api/v1/agent/credentials/rotate')
        .set('Authorization', `Bearer ${paired.token}`)
        .send({ token: next });
    expect((await stage()).status).toBe(200);
    expect((await stage()).status).toBe(200);
    const beat = (raw: string) =>
      request(app)
        .post('/api/v1/agent/heartbeat')
        .set('Authorization', `Bearer ${raw}`)
        .send(metadata);
    expect((await beat(paired.token)).status).toBe(200);
    expect((await beat(next)).status).toBe(401);
    const commit = () =>
      request(app)
        .post('/api/v1/agent/credentials/commit')
        .set('Authorization', `Bearer ${next}`)
        .send({});
    now = new Date(now.getTime() + 301000);
    expect((await commit()).status).toBe(401);
    expect((await beat(paired.token)).status).toBe(200);
    expect((await stage()).status).toBe(200); // Old credential can restage an expired pending candidate.
    const commits = await Promise.all([commit(), commit()]);
    expect(commits.map((r) => r.status)).toEqual([200, 200]);
    expect(
      await db.auditLog.count({
        where: { targetId: paired.deviceId, action: 'device.rotate.commit' },
      }),
    ).toBe(1);
    expect((await beat(paired.token)).status).toBe(401);
    expect((await beat(next)).status).toBe(200);
    expect((await commit()).status).toBe(200); // A response lost after commit is recoverable.
    const candidate = `agt_${randomBytes(32).toString('hex')}`;
    await service.stageRotation(next, candidate, randomUUID());
    await Promise.allSettled([
      service.commitRotation(candidate, randomUUID()),
      service.revoke(paired.deviceId, userId, randomUUID()),
    ]);
    expect(
      await db.deviceCredential.count({ where: { deviceId: paired.deviceId, revokedAt: null } }),
    ).toBe(0);
    expect((await beat(candidate)).status).toBe(401);
    expect((await service.list()).find((d) => d.id === paired.deviceId)?.onlineState).toBe(
      'REVOKED',
    );
  });
  it('expires device credentials and limits pair attempts durably', async () => {
    if (!db || !service) throw new Error('No database');
    const paired = await pair();
    now = new Date(now.getTime() + 86400001);
    await expect(service.authenticate(paired.token, 'agent:heartbeat')).rejects.toMatchObject({
      status: 401,
    });
    expect((await service.list()).find((d) => d.id === paired.deviceId)?.onlineState).toBe(
      'OFFLINE',
    );
    const attemptIp = `${prefix}-budget-ip`;
    try {
      const input = {
        ...metadata,
        platform: 'win32' as const,
        arch: 'x64' as const,
        capabilities: ['heartbeat' as const],
        code: `pair_${'f'.repeat(32)}`,
        label: prefix,
      };
      for (let index = 0; index < 10; index++)
        await expect(service.pair(input, attemptIp, randomUUID())).rejects.toMatchObject({
          status: 401,
        });
      await expect(
        new DeviceService(db, () => now).pair(input, attemptIp, randomUUID()),
      ).rejects.toMatchObject({ status: 429 });
    } finally {
      await db.authThrottle.deleteMany({ where: { key: digest(`pair.ip:${attemptIp}`) } });
    }
  });
});
