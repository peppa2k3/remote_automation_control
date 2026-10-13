import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../../src/database.js';
import { createApp } from '../../src/app.js';
import {
  AuthService,
  bootstrapOwner,
  defaultAuthSettings,
} from '../../src/modules/auth/service.js';
import { createAuthStore } from '../../src/modules/auth/store.js';
import { digest, hashPassword, tokenHash } from '../../src/modules/auth/crypto.js';

const enabled = process.env.RUN_DB_TESTS === '1';
const db = enabled ? createDatabase(process.env.DATABASE_URL ?? '') : undefined;
const prefix = `auth-${randomUUID()}`;
const password = 'Integration-only-password-004!';
const requestIds: string[] = [];
const throttleKeys: string[] = [];
const users: string[] = [];
function id() {
  const value = randomUUID();
  requestIds.push(value);
  return value;
}

describe.skipIf(!enabled)('PostgreSQL auth integration (isolated database only)', () => {
  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({
      where: { OR: [{ requestId: { in: requestIds } }, { actorId: { in: users } }] },
    });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.authThrottle.deleteMany({ where: { key: { in: throttleKeys } } });
    await db.$disconnect();
  });
  it('serializes owner bootstrap and prevents a second owner through SQL constraints', async () => {
    if (!db) throw new Error('Explicit test database required');
    // Never delete or replace an existing owner, even on a misconfigured test URL.
    expect(await db.user.count({ where: { role: 'OWNER' } })).toBe(0);
    const store = createAuthStore(db);
    const emails = [0, 1].map((n) => `${prefix}-owner-${n}@example.test`);
    try {
      const results = await Promise.allSettled(
        emails.map((email) => bootstrapOwner(store, email, password)),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const owner = await db.user.findFirstOrThrow({ where: { email: { in: emails } } });
      users.push(owner.id);
      expect(owner.passwordHash).not.toContain(password);
      await expect(
        db.user.create({
          data: {
            email: `${prefix}-third@example.test`,
            passwordHash: owner.passwordHash,
            role: 'OWNER',
          },
        }),
      ).rejects.toThrow();
      const auth = new AuthService(store);
      const context = await auth.login(
        { email: owner.email, password },
        `${prefix}-owner-ip`,
        id(),
      );
      throttleKeys.push(
        digest(`login.account:${owner.email}`),
        digest(`login.ip:${prefix}-owner-ip`),
      );
      const app = createApp({
        frontendOrigin: 'http://localhost:3000',
        auth,
        checkDatabase: async () => {},
      });
      const audit = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Cookie', `automation_session=${context.token}`);
      expect(audit.status).toBe(200);
      expect(JSON.stringify(audit.body)).not.toContain(context.token);
    } finally {
      const created = await db.user.findMany({ where: { email: { in: emails } } });
      for (const user of created) {
        await db.auditLog.deleteMany({ where: { actorId: user.id } });
        await db.user.delete({ where: { id: user.id } });
      }
    }
  }, 15_000);
  it('persists hashed sessions, reads latest role and atomically rotates or revokes sessions', async () => {
    if (!db) throw new Error('Explicit test database required');
    const email = `${prefix}-viewer@example.test`,
      ip = `${prefix}-viewer-ip`;
    const user = await db.user.create({
      data: { email, passwordHash: await hashPassword(password), role: 'VIEWER' },
    });
    users.push(user.id);
    throttleKeys.push(digest(`login.account:${email}`), digest(`login.ip:${ip}`));
    const auth = new AuthService(createAuthStore(db));
    const context = await auth.login({ email, password }, ip, id());
    expect(
      await db.authSession.findUnique({ where: { tokenHash: tokenHash(context.token) } }),
    ).not.toBeNull();
    expect(
      JSON.stringify(await db.authSession.findMany({ where: { userId: user.id } })),
    ).not.toContain(context.token);
    const app = createApp({
      frontendOrigin: 'http://localhost:3000',
      auth,
      checkDatabase: async () => {},
    });
    expect(
      (
        await request(app)
          .get('/api/v1/admin/audit-logs')
          .set('Cookie', `automation_session=${context.token}`)
      ).status,
    ).toBe(403);
    const rotated = await Promise.allSettled([
      auth.refresh(context, id()),
      auth.refresh(context, id()),
    ]);
    expect(rotated.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(auth.authenticate(context.token)).rejects.toMatchObject({ status: 401 });
    const next = rotated.find((r) => r.status === 'fulfilled');
    if (next?.status !== 'fulfilled') throw new Error('No rotated session');
    await Promise.allSettled([auth.refresh(next.value, id()), auth.revokeAll(next.value, id())]);
    expect(await db.authSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    const login = await auth.login({ email, password }, ip, id());
    await db.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
    await expect(auth.authenticate(login.token)).rejects.toMatchObject({ status: 401 });
  }, 15_000);
  it('serializes concurrent login budgets and persists them across service instances', async () => {
    if (!db) throw new Error('Explicit test database required');
    const key = digest(`${prefix}-concurrent-budget`);
    throttleKeys.push(key);
    const store = createAuthStore(db),
      now = new Date();
    const attempts = await Promise.all(
      Array.from({ length: 12 }, () => store.consumeAttempts([{ key, limit: 3 }], now, 900)),
    );
    expect(attempts.filter(Boolean)).toHaveLength(3);
    expect(await db.authThrottle.findUnique({ where: { key } })).toMatchObject({ count: 3 });
    expect(await createAuthStore(db).consumeAttempts([{ key, limit: 3 }], now, 900)).toBe(false);
    const email = `${prefix}-missing@example.test`,
      ip = `${prefix}-missing-ip`;
    throttleKeys.push(digest(`login.account:${email}`), digest(`login.ip:${ip}`));
    const settings = { ...defaultAuthSettings, accountLimit: 1 };
    await expect(
      new AuthService(store, settings).login({ email, password }, ip, id()),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    await expect(
      new AuthService(createAuthStore(db), settings).login({ email, password }, ip, id()),
    ).rejects.toMatchObject({ status: 429 });
  }, 15_000);
});
