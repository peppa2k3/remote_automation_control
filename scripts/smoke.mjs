import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const apiPort = await freePort();
const webPort = await freePort();
const apiUrl = `http://127.0.0.1:${apiPort}/api/v1`;
const webUrl = `http://127.0.0.1:${webPort}`;
const env = {
  ...process.env,
  DOTENV_CONFIG_PATH: '__smoke_env_disabled__',
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: String(apiPort),
  FRONTEND_ORIGIN: webUrl,
  DATABASE_URL: process.env.SMOKE_DATABASE_URL ?? '',
  LOG_LEVEL: 'silent',
};
if (!env.DATABASE_URL) delete env.DATABASE_URL;
const children = [];
let fixture;
let db;
function start(args, cwd, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.on('error', () => console.error(`Runtime process could not start: ${cwd}`));
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => console.error(`${cwd}: ${String(chunk)}`));
  children.push(child);
  return child;
}
async function waitFor(url) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    assert.ok(
      !children.some((child) => child.exitCode !== null && child.exitCode !== 0),
      'Runtime process exited before startup',
    );
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) return response;
    } catch {
      /* wait for startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Runtime did not become available: ${new URL(url).pathname}`);
}
try {
  start(['dist/server.js'], 'backend');
  const live = await waitFor(`${apiUrl}/health/live`);
  const envelope = await live.json();
  assert.equal(envelope.success, true);
  assert.equal(envelope.requestId, live.headers.get('x-request-id'));
  const ready = process.env.SMOKE_DATABASE_URL
    ? await waitFor(`${apiUrl}/health/ready`)
    : await fetch(`${apiUrl}/health/ready`);
  assert.equal(ready.status, process.env.SMOKE_DATABASE_URL ? 200 : 503);
  console.log('PASS: backend live, request correlation and database readiness');
  start(
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(webPort)],
    'frontend',
    { NODE_ENV: 'production', API_INTERNAL_BASE_URL: apiUrl, AUTH_FRONTEND_ORIGIN: webUrl },
  );
  const loginHtml = await (await waitFor(`${webUrl}/login`)).text();
  assert.ok(loginHtml.includes('Đăng nhập quản trị'));
  const anonymous = await fetch(webUrl, { redirect: 'manual' });
  assert.equal(anonymous.status, 307);
  assert.equal(anonymous.headers.get('location'), '/login');
  assert.equal((await fetch(`${apiUrl}/admin/audit-logs`)).status, 401);
  if (env.DATABASE_URL) {
    const { createDatabase } = await import('../backend/dist/database.js');
    const { hashPassword, digest } = await import('../backend/dist/modules/auth/crypto.js');
    db = createDatabase(env.DATABASE_URL);
    const email = `smoke-${randomUUID()}@example.test`,
      password = randomBytes(24).toString('hex');
    const user = await db.user.create({
      data: { email, passwordHash: await hashPassword(password), role: 'ADMIN' },
    });
    fixture = { userId: user.id, accountKey: digest(`login.account:${email}`) };
    async function mutation(action, cookie, csrf) {
      return fetch(`${webUrl}/api/v1/auth/${action}`, {
        method: 'POST',
        headers: {
          Origin: webUrl,
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: action === 'login' ? JSON.stringify({ email, password }) : '{}',
      });
    }
    const login = await mutation('login');
    assert.equal(login.status, 200);
    const auth = (await login.json()).data;
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie && login.headers.get('set-cookie').includes('HttpOnly'));
    const home = await fetch(webUrl, { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.ok(html.includes('API đang hoạt động') && html.includes('Database sẵn sàng'));
    assert.equal((await mutation('refresh', cookie)).status, 403);
    const refresh = await mutation('refresh', cookie, auth.csrfToken);
    assert.equal(refresh.status, 200);
    const next = (await refresh.json()).data;
    const rotatedCookie = refresh.headers.get('set-cookie')?.split(';')[0];
    assert.ok(rotatedCookie && rotatedCookie !== cookie);
    assert.equal(
      (await fetch(`${webUrl}/api/v1/auth/me`, { headers: { Cookie: cookie } })).status,
      401,
    );
    assert.equal((await mutation('logout', rotatedCookie, next.csrfToken)).status, 200);
    assert.equal(
      (await fetch(webUrl, { headers: { Cookie: rotatedCookie }, redirect: 'manual' })).status,
      307,
    );
    console.log(
      'PASS: PostgreSQL-backed login, protected SSR, CSRF, session rotation and logout through frontend proxy',
    );
  }
  const manifest = await (await fetch(`${webUrl}/manifest.webmanifest`)).json();
  assert.equal(manifest.display, 'standalone');
  console.log('PASS: anonymous redirect, login page and manifest');
  const agent = start(['dist/cli.js'], 'agent-windows', {
    AGENT_API_BASE_URL: apiUrl,
    AGENT_ALLOW_LOCAL_HTTP: 'true',
  });
  const exitCode = await new Promise((resolve) => agent.once('exit', resolve));
  assert.equal(exitCode, 0);
  console.log('PASS: native Agent connects outbound and exits successfully');
} finally {
  await Promise.all(
    children.map((child) =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => {
            child.once('exit', resolve);
            child.kill();
          }),
    ),
  );
  if (db) {
    try {
      if (fixture) {
        await db.auditLog.deleteMany({ where: { actorId: fixture.userId } });
        await db.user.delete({ where: { id: fixture.userId } });
        await db.authThrottle.deleteMany({ where: { key: fixture.accountKey } });
      }
    } finally {
      await db.$disconnect();
    }
  }
}
