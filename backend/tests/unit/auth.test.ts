import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { authResponseSchema, SESSION_COOKIE_NAME } from '@automation/contracts';
import { createApp } from '../../src/app.js';
import {
  AuthService,
  bootstrapOwner,
  defaultAuthSettings,
} from '../../src/modules/auth/service.js';
import { hashPassword, verifyPassword } from '../../src/modules/auth/crypto.js';
import { MemoryAuthStore } from '../helpers/memory-auth-store.js';

const origin = 'https://app.example.com',
  password = 'Test-only-password-004!';
let hash: string;
beforeAll(async () => {
  hash = await hashPassword(password);
});
function fixture() {
  const store = new MemoryAuthStore();
  let now = new Date('2026-10-13T00:00:00Z');
  const user = {
    id: randomUUID(),
    email: 'owner@example.com',
    passwordHash: hash,
    role: 'OWNER' as const,
    status: 'ACTIVE' as const,
    mfaEnabled: false,
  };
  store.users.set(user.id, user);
  const auth = new AuthService(
    store,
    { ...defaultAuthSettings, accountLimit: 100, ipLimit: 100 },
    () => now,
  );
  const logs: unknown[] = [];
  const app = createApp({
    auth,
    secureCookies: true,
    frontendOrigin: origin,
    checkDatabase: async () => {},
    log: (entry) => logs.push(entry),
  });
  const login = (email = user.email, pass = password) =>
    request(app).post('/api/v1/auth/login').set('Origin', origin).send({ email, password: pass });
  return {
    store,
    user,
    auth,
    app,
    login,
    logs,
    advance: (seconds: number) => {
      now = new Date(now.getTime() + seconds * 1000);
    },
  };
}
function cookie(response: { headers: Record<string, unknown> }) {
  return (response.headers['set-cookie'] as string[])[0]!.split(';')[0]!;
}
describe('admin authentication boundaries', () => {
  it('uses salted scrypt and enforces exact password semantics', async () => {
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(`${password} `, hash)).toBe(false);
    expect(await hashPassword(password)).not.toBe(hash);
  });
  it('rejects anonymous business/agent requests while health remains public', async () => {
    const { app } = fixture();
    expect((await request(app).get('/api/v1/admin/audit-logs')).status).toBe(401);
    expect((await request(app).post('/api/v1/workflow-definitions').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/agent/jobs/claim').send({})).body.error.code).toBe(
      'DEVICE_AUTH_REQUIRED',
    );
    expect((await request(app).get('/api/v1/health/live')).status).toBe(200);
  });
  it('creates HttpOnly/Secure/Strict cookies and stores only a hash; DTO/log/audit omit secrets', async () => {
    const f = fixture(),
      response = await f.login('OWNER@example.com');
    expect(response.status).toBe(200);
    expect(authResponseSchema.safeParse(response.body).success).toBe(true);
    const rawCookie = cookie(response),
      token = rawCookie.split('=')[1]!;
    const setCookie = (response.headers['set-cookie'] as string[])[0]!;
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/'])
      expect(setCookie).toContain(attribute);
    expect(setCookie).not.toContain('Domain=');
    expect(JSON.stringify([...f.store.sessions.values()])).not.toContain(token);
    for (const value of [response.text, JSON.stringify(f.logs), JSON.stringify(f.store.events)]) {
      expect(value).not.toContain(password);
      expect(value).not.toContain(token);
      expect(value).not.toContain(hash);
    }
    const me = await request(f.app).get('/api/v1/auth/me').set('Cookie', rawCookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(f.user.id);
    expect(
      (await request(f.app).get('/api/v1/auth/sessions').set('Cookie', rawCookie)).text,
    ).not.toContain('tokenHash');
    expect(
      (await request(f.app).post('/api/v1/agent/jobs/claim').set('Cookie', rawCookie).send({}))
        .status,
    ).toBe(401);
  });
  it('denies absent/foreign origin, non-JSON login and caller-supplied role', async () => {
    const { app } = fixture();
    for (const candidate of [undefined, 'https://attacker.example.com', 'null']) {
      let req = request(app).post('/api/v1/auth/login');
      if (candidate) req = req.set('Origin', candidate);
      expect((await req.send({ email: 'owner@example.com', password })).status).toBe(403);
    }
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', origin)
          .type('form')
          .send({ email: 'owner@example.com', password })
      ).status,
    ).toBe(415);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', origin)
          .send({ email: 'owner@example.com', password, role: 'OWNER' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('Origin', origin)
          .send({ email: 'owner@example.com', password: '🙂'.repeat(40) })
      ).status,
    ).toBe(400);
  });
  it('checks CSRF against the exact session and atomically rotates refresh tokens', async () => {
    const f = fixture(),
      first = await f.login(),
      second = await f.login();
    const firstCookie = cookie(first),
      secondCookie = cookie(second);
    for (const token of [undefined, 'x'.repeat(43), second.body.data.csrfToken]) {
      let req = request(f.app)
        .post('/api/v1/auth/refresh')
        .set('Origin', origin)
        .set('Cookie', firstCookie);
      if (token) req = req.set('X-CSRF-Token', token);
      expect((await req.send({})).status).toBe(403);
    }
    const refresh = () =>
      request(f.app)
        .post('/api/v1/auth/refresh')
        .set('Origin', origin)
        .set('Cookie', firstCookie)
        .set('X-CSRF-Token', first.body.data.csrfToken)
        .send({});
    const results = await Promise.all([refresh(), refresh()]);
    expect(results.map((item) => item.status).sort()).toEqual([200, 401]);
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', firstCookie)).status).toBe(
      401,
    );
    const renewed = results.find((item) => item.status === 200)!;
    expect(cookie(renewed)).not.toBe(firstCookie);
    expect(renewed.body.data.csrfToken).not.toBe(first.body.data.csrfToken);
    expect(
      (await request(f.app).get('/api/v1/auth/me').set('Cookie', cookie(renewed))).status,
    ).toBe(200);
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', secondCookie)).status).toBe(
      200,
    );
  });
  it('revokes one session on logout, all on revoke-all, and clears the cookie', async () => {
    const f = fixture(),
      first = await f.login(),
      second = await f.login();
    const logout = await request(f.app)
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie(first))
      .set('X-CSRF-Token', first.body.data.csrfToken)
      .send({});
    expect(logout.status).toBe(200);
    expect((logout.headers['set-cookie'] as string[])[0]).toContain('Expires=Thu, 01 Jan 1970');
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', cookie(first))).status).toBe(
      401,
    );
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', cookie(second))).status).toBe(
      200,
    );
    expect(
      (
        await request(f.app)
          .post('/api/v1/auth/revoke-all')
          .set('Origin', origin)
          .set('Cookie', cookie(second))
          .set('X-CSRF-Token', second.body.data.csrfToken)
          .send({})
      ).status,
    ).toBe(200);
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', cookie(second))).status).toBe(
      401,
    );
  });
  it('re-reads role/status/MFA and enforces expiry, not client identity fields', async () => {
    const f = fixture(),
      signed = await f.login();
    f.store.users.set(f.user.id, { ...f.user, role: 'ADMIN' });
    expect(
      (await request(f.app).get('/api/v1/admin/audit-logs').set('Cookie', cookie(signed))).status,
    ).toBe(403);
    f.store.users.set(f.user.id, { ...f.user, role: 'VIEWER' });
    expect(
      (await request(f.app).get('/api/v1/admin/audit-logs').set('Cookie', cookie(signed))).status,
    ).toBe(403);
    expect(
      (
        await request(f.app)
          .post('/api/v1/workflow-definitions')
          .set('Cookie', cookie(signed))
          .set('Origin', origin)
          .set('X-CSRF-Token', signed.body.data.csrfToken)
          .send({})
      ).status,
    ).toBe(403);
    f.store.users.set(f.user.id, { ...f.user, status: 'DISABLED' });
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', cookie(signed))).status).toBe(
      401,
    );
    f.store.users.set(f.user.id, { ...f.user, mfaEnabled: true });
    expect((await f.login()).body.error.code).toBe('MFA_REQUIRED');
    f.store.users.set(f.user.id, f.user);
    f.advance(1801);
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', cookie(signed))).status).toBe(
      401,
    );
  });
  it('caps refresh at absolute expiry and rejects duplicate cookies', async () => {
    const f = fixture(),
      context = await f.auth.login({ email: f.user.email, password }, 'test-ip', randomUUID());
    f.advance(1700);
    let current = await f.auth.refresh(context, randomUUID());
    for (let index = 0; index < 15; index++) {
      f.advance(1700);
      current = await f.auth.refresh(await f.auth.authenticate(current.token), randomUUID());
    }
    expect(current.session.expiresAt <= context.session.absoluteExpiresAt).toBe(true);
    f.advance(3000);
    await expect(f.auth.authenticate(current.token)).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });
    const duplicate = `${SESSION_COOKIE_NAME}=${context.token}; ${SESSION_COOKIE_NAME}=${context.token}`;
    expect((await request(f.app).get('/api/v1/auth/me').set('Cookie', duplicate)).status).toBe(401);
  });
  it('persists brute-force limits across service instances and resets the window', async () => {
    const f = fixture();
    let now = new Date('2026-10-13T00:00:00Z');
    const settings = { ...defaultAuthSettings, accountLimit: 2, ipLimit: 3 };
    const first = new AuthService(f.store, settings, () => now),
      second = new AuthService(f.store, settings, () => now);
    for (let i = 0; i < 2; i++)
      await expect(
        first.login({ email: f.user.email, password: 'wrong' }, 'ip', randomUUID()),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      second.login({ email: f.user.email, password }, 'different-ip', randomUUID()),
    ).rejects.toMatchObject({ code: 'LOGIN_RATE_LIMITED' });
    now = new Date(now.getTime() + 901000);
    expect(
      (await second.login({ email: f.user.email, password }, 'ip', randomUUID())).user.id,
    ).toBe(f.user.id);
    // Different account keys still share the IP budget; caller-controlled forwarded
    // headers never replace the socket address used by the HTTP handler.
    for (let i = 0; i < 3; i++)
      await expect(
        first.login({ email: `missing-${i}@example.com`, password }, 'shared-ip', randomUUID()),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      second.login({ email: 'another@example.com', password }, 'shared-ip', randomUUID()),
    ).rejects.toMatchObject({ code: 'LOGIN_RATE_LIMITED' });
  });
  it('creates one owner and refuses overwrite or weak bootstrap passwords', async () => {
    const store = new MemoryAuthStore();
    await bootstrapOwner(store, 'first@example.com', password);
    await expect(bootstrapOwner(store, 'second@example.com', password)).rejects.toMatchObject({
      code: 'OWNER_EXISTS',
    });
    await expect(bootstrapOwner(store, 'third@example.com', 'short')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect([...store.users.values()]).toHaveLength(1);
  });
});
