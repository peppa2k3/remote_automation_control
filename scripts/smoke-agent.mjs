import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { createDatabase } from '../backend/dist/database.js';
import { hashPassword, digest } from '../backend/dist/modules/auth/crypto.js';
import { parseAgentConfig } from '../agent-windows/dist/config.js';
import { HttpDeviceClient, AgentApiError } from '../agent-windows/dist/core/client.js';
import { DpapiCredentialStore } from '../agent-windows/dist/core/credential-store.js';

const osResult =
  process.platform === 'win32' && process.env.SystemRoot
    ? spawnSync(
        join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-CimInstance Win32_OperatingSystem | Select-Object BuildNumber,ProductType | ConvertTo-Json -Compress',
        ],
        { windowsHide: true, encoding: 'utf8', timeout: 15000 },
      )
    : undefined;
const osInfo = osResult?.status === 0 ? JSON.parse(osResult.stdout) : undefined;
const windows11 =
  process.platform === 'win32' && Number(osInfo?.BuildNumber) >= 22000 && osInfo?.ProductType === 1;
if (
  process.platform !== 'win32' ||
  (!windows11 && !process.argv.includes('--allow-windows-10')) ||
  !process.env.SMOKE_DATABASE_URL
) {
  console.error(
    'Agent smoke cần Windows 11 và SMOKE_DATABASE_URL trỏ tới DB test riêng đã migrate. --allow-windows-10 chỉ kiểm tra tương thích, không chứng minh Win11.',
  );
  process.exit(1);
}
const children = [],
  apiLogs = [],
  secrets = [];
const root = resolve('.verification'),
  stateDirectory = join(root, `005-agent-${randomUUID()}`);
await mkdir(root, { recursive: true });
const db = createDatabase(process.env.SMOKE_DATABASE_URL);
async function cleanupState() {
  const target = resolve(stateDirectory);
  if (dirname(target) !== root || !target.startsWith(join(root, '005-agent-')))
    throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
}
let owner, deviceId;
let phase = 'database-fixture';
const fixtureLabel = `Native Windows smoke ${randomUUID()}`;
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const port = await freePort(),
  webPort = await freePort();
const base = `http://127.0.0.1:${port}/api/v1`,
  origin = `http://127.0.0.1:${webPort}`;
const environment = {
  ...process.env,
  NODE_ENV: 'development',
  DOTENV_CONFIG_PATH: '__smoke_env_disabled__',
  DATABASE_URL: process.env.SMOKE_DATABASE_URL,
  HOST: '127.0.0.1',
  PORT: String(port),
  FRONTEND_ORIGIN: origin,
  LOG_LEVEL: 'info',
  AGENT_API_BASE_URL: base,
  AGENT_ALLOW_LOCAL_HTTP: 'true',
  AGENT_STATE_DIR: stateDirectory,
  AGENT_REQUEST_TIMEOUT_MS: '5000',
  API_INTERNAL_BASE_URL: base,
  AUTH_FRONTEND_ORIGIN: origin,
};
function start(args, cwd) {
  const childEnvironment = {
    ...environment,
    ...(cwd === 'frontend' ? { NODE_ENV: 'production' } : {}),
  };
  if (cwd !== 'backend') {
    delete childEnvironment.DATABASE_URL;
    delete childEnvironment.SMOKE_DATABASE_URL;
  }
  const child = spawn(process.execPath, args, {
    cwd,
    env: childEnvironment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.output = '';
  const collect = (chunk) => {
    child.output += String(chunk);
    if (child.output.length > 512000) child.output = child.output.slice(-512000);
    if (cwd === 'backend') apiLogs.push(String(chunk));
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('error', () => {});
  children.push(child);
  return child;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const done = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await done;
}
async function waitFor(predicate, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('SMOKE_TIMEOUT');
}
async function ready() {
  await waitFor(async () => {
    try {
      return (await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      return false;
    }
  });
}
async function cli(command) {
  const child = start(['dist/core/cli.js', command], 'agent-windows');
  const code = await new Promise((resolve) => child.once('exit', resolve));
  assert.equal(code, 0, 'Native CLI failed');
  return child;
}
try {
  assert.equal(await db.user.count(), 0, 'Use an empty isolated test DB with no users');
  assert.equal(await db.device.count(), 0, 'Use an empty isolated test DB with no devices');
  const email = `agent-smoke-${randomUUID()}@example.test`,
    password = randomBytes(24).toString('hex');
  secrets.push(password);
  owner = await db.user.create({
    data: { email, passwordHash: await hashPassword(password), role: 'OWNER' },
  });
  let api = start(['dist/server.js'], 'backend');
  await ready();
  phase = 'frontend-startup';
  start(
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(webPort)],
    'frontend',
  );
  await waitFor(async () => {
    try {
      return (await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      return false;
    }
  });
  assert.equal((await fetch(`${origin}/devices`, { redirect: 'manual' })).status, 307);
  phase = 'frontend-login';
  const login = await fetch(`${origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const session = (await login.json()).data,
    cookie = login.headers.get('set-cookie').split(';')[0];
  secrets.push(cookie.split('=')[1]);
  async function admin(path) {
    return fetch(`${origin}/api/v1/${path}`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        Cookie: cookie,
        'X-CSRF-Token': session.csrfToken,
      },
      body: '{}',
    });
  }
  phase = 'owner-devices-page';
  const devicesPage = await fetch(`${origin}/devices`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
  assert.equal(devicesPage.status, 200);
  assert.ok((await devicesPage.text()).includes('Tạo mã ghép đôi'), 'Owner devices UI unavailable');
  const listing = await fetch(`${origin}/api/v1/devices`, { headers: { Cookie: cookie } });
  assert.equal(listing.status, 200);
  phase = 'frontend-pairing-code';
  const codeResponse = await admin('devices/pairing-code');
  assert.equal(codeResponse.status, 200);
  const code = (await codeResponse.json()).data.code;
  secrets.push(code);
  const client = new HttpDeviceClient(parseAgentConfig(environment));
  const metadata = {
    platform: 'win32',
    arch: process.arch,
    version: '0.1.0',
    capabilities: ['diagnostics', 'heartbeat'],
  };
  phase = 'native-pair';
  const paired = await client.pair({ ...metadata, label: fixtureLabel, code });
  deviceId = paired.deviceId;
  secrets.push(paired.token);
  phase = 'dpapi-roundtrip';
  const store = new DpapiCredentialStore(stateDirectory);
  await store.exclusive(async () => {
    const { token, ...identity } = paired;
    await store.save({ version: 1, apiBaseUrl: base, token, identity });
    assert.ok((await store.load()).token === paired.token, 'DPAPI round-trip failed');
    assert.ok(
      !(await readFile(store.file, 'utf8')).includes(paired.token),
      'Plaintext credential found',
    );
  });
  await assert.rejects(client.pair({ ...metadata, label: 'Code replay', code }));
  phase = 'native-cli';
  await cli('heartbeat');
  await cli('heartbeat'); // Separate processes reload DPAPI after restart.
  await cli('rotate');
  await cli('heartbeat');
  await assert.rejects(client.heartbeat(paired.token, metadata));
  const rotated = await store.load();
  secrets.push(rotated.token);
  phase = 'outage-reconnect';
  const agent = start(['dist/core/cli.js', 'run'], 'agent-windows');
  await waitFor(() => agent.output.includes('agent.connected'));
  await stop(api);
  await waitFor(() => agent.output.includes('agent.reconnecting'), 45000);
  api = start(['dist/server.js'], 'backend');
  await ready();
  await waitFor(() => (agent.output.match(/agent.connected/g) ?? []).length >= 2);
  phase = 'frontend-revoke';
  assert.equal((await admin(`devices/${deviceId}/revoke`)).status, 200);
  await waitFor(() => agent.exitCode !== null, 45000);
  assert.equal(agent.exitCode, 1);
  assert.ok(agent.output.includes('agent.auth_rejected'));
  phase = 'secret-free-logs';
  const logs = `${apiLogs.join('')}\n${children.map((child) => child.output).join('\n')}`;
  for (const secret of secrets)
    assert.ok(!logs.includes(secret), 'Credential present in runtime logs');
  console.log(
    `PASS: frontend owner device proxy + native ${windows11 ? 'Windows 11' : 'Windows 10 (Win11 gate pending)'} pairing, DPAPI, process restart, rotate, API outage/reconnect, revoke and secret-free logs`,
  );
} catch (error) {
  console.error(
    `FAIL: Agent smoke (${phase}, HTTP ${error instanceof AgentApiError ? error.status : 'unavailable'}). Chi tiết không được in để bảo vệ credential; kiểm tra DB test và các test module.`,
  );
  process.exitCode = 1;
} finally {
  for (const child of children) await stop(child);
  try {
    if (owner) {
      const fixtures = await db.device.findMany({ where: { label: fixtureLabel } });
      const fixtureIds = fixtures.map((device) => device.id);
      await db.auditLog.deleteMany({
        where: { OR: [{ actorId: owner.id }, { targetId: { in: fixtureIds } }] },
      });
      await db.device.deleteMany({ where: { id: { in: fixtureIds } } });
      await db.user.delete({ where: { id: owner.id } });
      await db.authThrottle.deleteMany({
        where: {
          key: {
            in: [
              digest(`pair.mint:${owner.id}`),
              digest(`login.account:${owner.email}`),
              digest('pair.ip:127.0.0.1'),
              digest('login.ip:127.0.0.1'),
            ],
          },
        },
      });
    }
  } finally {
    await db.$disconnect();
    await cleanupState();
  }
}
