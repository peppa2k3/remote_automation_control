import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

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
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: String(apiPort),
  FRONTEND_ORIGIN: webUrl,
  DATABASE_URL: process.env.SMOKE_DATABASE_URL ?? '',
  LOG_LEVEL: 'silent',
};
if (!env.DATABASE_URL) delete env.DATABASE_URL;
const children = [];
function start(args, cwd, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.on('error', () => {});
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  children.push(child);
  return child;
}
async function waitFor(url) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
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
  const ready = await fetch(`${apiUrl}/health/ready`);
  assert.equal(ready.status, process.env.SMOKE_DATABASE_URL ? 200 : 503);
  console.log('PASS: backend live, request correlation and database readiness');
  start(
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(webPort)],
    'frontend',
    { NODE_ENV: 'production', API_INTERNAL_BASE_URL: apiUrl },
  );
  const html = await (await waitFor(webUrl)).text();
  assert.ok(html.includes('Automation') && html.includes('Kết nối API'));
  assert.ok(html.includes('API đang hoạt động'));
  assert.ok(
    html.includes(process.env.SMOKE_DATABASE_URL ? 'Database sẵn sàng' : 'Database chưa sẵn sàng'),
  );
  const manifest = await (await fetch(`${webUrl}/manifest.webmanifest`)).json();
  assert.equal(manifest.display, 'standalone');
  console.log('PASS: frontend renders real API/DB state and manifest');
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
}
