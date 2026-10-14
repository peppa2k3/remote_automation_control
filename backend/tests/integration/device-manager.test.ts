import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../../src/database.js';
import { createApp } from '../../src/app.js';
import { AuthService } from '../../src/modules/auth/service.js';
import { createAuthStore } from '../../src/modules/auth/store.js';
import { hashPassword, digest } from '../../src/modules/auth/crypto.js';
import { DeviceService } from '../../src/modules/devices/service.js';

const enabled = process.env.RUN_DB_TESTS === '1';
const db = enabled ? createDatabase(process.env.DATABASE_URL ?? '') : undefined;
const prefix = `manager-${randomUUID()}`,
  origin = 'http://localhost:3000';
const password = 'Test-core-manager-password-021!';
let now = new Date();
const devices = db ? new DeviceService(db, () => now) : undefined;
const auth = db ? new AuthService(createAuthStore(db)) : undefined;
const app = createApp({
  frontendOrigin: origin,
  devices,
  auth,
  checkDatabase: async () => {},
  rateLimitMax: 1000,
});
const people: { id: string; email: string; cookie: string; csrf: string }[] = [];
const deviceIds: string[] = [];
const metadata = { platform: 'win32', arch: 'x64', version: '0.1.0', capabilities: ['heartbeat'] };
function asUser(index: number, path: string, body?: object) {
  const user = people[index]!;
  const req =
    body === undefined
      ? request(app).get(`/api/v1/${path}`)
      : request(app).post(`/api/v1/${path}`).send(body);
  return req.set('Cookie', user.cookie).set('Origin', origin).set('X-CSRF-Token', user.csrf);
}
async function pair(index: number) {
  const code = await asUser(index, 'devices/pairing-code', {});
  expect(code.status).toBe(200);
  expect(code.body.data.code).toMatch(/^pair_[a-f0-9]{64}$/);
  const result = await request(app)
    .post('/api/v1/agent/pair')
    .send({ ...metadata, label: prefix, code: code.body.data.code });
  expect(result.status).toBe(200);
  deviceIds.push(result.body.data.deviceId);
  return result.body.data as { deviceId: string; token: string };
}
describe.skipIf(!enabled)('core device ownership, shared monitoring and runtime', () => {
  beforeAll(async () => {
    if (!db || !auth) throw new Error('Explicit test DB required');
    const passwordHash = await hashPassword(password);
    for (let i = 0; i < 3; i++) {
      const user = await db.user.create({
        data: {
          email: `${prefix}-${i}@example.test`,
          passwordHash,
          role: i === 0 ? 'OWNER' : 'VIEWER',
        },
      });
      const login = await auth.login({ email: user.email, password }, prefix, randomUUID());
      people.push({
        id: user.id,
        email: user.email,
        cookie: `automation_session=${login.token}`,
        csrf: auth.data(login).csrfToken,
      });
    }
  });
  afterAll(async () => {
    if (!db) return;
    const userIds = people.map((p) => p.id);
    const codes = await db.pairingCode.findMany({ where: { createdBy: { in: userIds } } });
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: userIds } },
          { targetId: { in: [...deviceIds, ...codes.map((c) => c.id)] } },
        ],
      },
    });
    await db.device.deleteMany({ where: { id: { in: deviceIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.authThrottle.deleteMany({
      where: {
        key: {
          in: [
            digest(`login.ip:${prefix}`),
            digest('pair.ip:::ffff:127.0.0.1'),
            ...people.flatMap((p) => [
              digest(`login.account:${p.email}`),
              digest(`pair.mint:${p.id}`),
            ]),
          ],
        },
      },
    });
    await db.$disconnect();
  });
  it('filters by device ownership, shares viewer/operator, rejects escalation and removes access', async () => {
    const device = await pair(1); // Global VIEWER may own their own device.
    const path = `devices/${device.deviceId}`;
    expect((await asUser(0, 'devices')).body.data).toEqual([]); // No implicit global admin bypass.
    expect((await asUser(1, 'devices')).body.data[0].role).toBe('OWNER');
    expect((await asUser(0, `${path}/activity`)).status).toBe(403);
    expect((await asUser(0, `${path}/revoke`, {})).status).toBe(403);
    expect(
      (await asUser(1, `${path}/members`, { email: people[2]!.email, role: 'OWNER' })).status,
    ).toBe(400);
    expect(
      (await asUser(1, `${path}/members`, { email: people[2]!.email, role: 'VIEWER' })).status,
    ).toBe(200);
    expect((await asUser(2, 'devices')).body.data[0]).toMatchObject({
      role: 'VIEWER',
      credentialFingerprint: null,
    });
    expect((await asUser(2, `${path}/activity`)).status).toBe(200);
    expect((await asUser(2, `${path}/members`)).status).toBe(403);
    expect(
      (await asUser(2, `${path}/members`, { email: people[0]!.email, role: 'OPERATOR' })).status,
    ).toBe(403);
    expect(
      (await asUser(1, `${path}/members`, { email: people[2]!.email, role: 'OPERATOR' })).status,
    ).toBe(200);
    expect((await asUser(2, 'devices')).body.data[0].role).toBe('OPERATOR');
    expect((await asUser(2, `${path}/revoke`, {})).status).toBe(403);
    expect((await asUser(1, `${path}/members/remove`, { userId: people[2]!.id })).status).toBe(200);
    expect((await asUser(2, 'devices')).body.data).toEqual([]);
    expect((await asUser(2, `${path}/activity`)).status).toBe(403);
  });
  it('validates telemetry, expires presence at 25s, requires fresh heartbeat after restart and revokes', async () => {
    if (!db || !devices) throw new Error('DB required');
    const device = await pair(0);
    const runtime = {
      hostname: 'test-machine',
      uptimeSeconds: 3600,
      agentUptimeSeconds: 10,
      memoryTotalBytes: 16000,
      memoryFreeBytes: 8000,
      cpuCount: 4,
    };
    const beat = (body: object) =>
      request(app)
        .post('/api/v1/agent/heartbeat')
        .set('Authorization', `Bearer ${device.token}`)
        .send(body);
    expect(
      (await beat({ ...metadata, runtime: { ...runtime, memoryFreeBytes: 20000 } })).status,
    ).toBe(400);
    expect((await beat({ ...metadata, runtime, command: 'anything' })).status).toBe(400);
    expect((await beat({ ...metadata, runtime })).body.data.heartbeatAfterSeconds).toBe(5);
    expect((await devices.list(people[0]!.id))[0]).toMatchObject({
      onlineState: 'ONLINE',
      runtime,
    });
    now = new Date(now.getTime() + 25001);
    expect((await devices.list(people[0]!.id))[0]!.onlineState).toBe('OFFLINE');
    await beat({ ...metadata, runtime });
    now = new Date(now.getTime() + 1);
    const restarted = new DeviceService(db, () => now);
    expect((await restarted.list(people[0]!.id))[0]!.onlineState).toBe('OFFLINE');
    await restarted.heartbeat(device.token, {
      platform: 'win32',
      arch: 'x64',
      version: '0.1.0',
      capabilities: ['heartbeat'],
      runtime,
    });
    expect((await restarted.list(people[0]!.id))[0]!.onlineState).toBe('ONLINE');
    const history = await asUser(0, `devices/${device.deviceId}/activity`);
    expect(history.body.data.some((e: { action: string }) => e.action === 'device.online')).toBe(
      true,
    );
    expect(JSON.stringify(history.body)).not.toContain(device.token);
    expect((await asUser(0, `devices/${device.deviceId}/revoke`, {})).status).toBe(200);
    expect((await beat({ ...metadata, runtime })).status).toBe(401);
    expect((await restarted.list(people[0]!.id))[0]!.onlineState).toBe('REVOKED');
  });
});
