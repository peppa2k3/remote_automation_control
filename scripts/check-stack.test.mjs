import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkStack } from './check-stack.mjs';

async function fixture(t, overrides = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    if (overrides[req.url]) return overrides[req.url](res);
    if (req.url.startsWith('/api/v1/health/')) {
      res.setHeader('x-request-id', 'test-request');
      res.end(
        JSON.stringify({ success: true, requestId: 'test-request', data: { database: 'up' } }),
      );
    } else if (req.url === '/') {
      res.writeHead(307, { location: '/login' }).end();
    } else if (req.url === '/api/v1/devices') {
      res.writeHead(401).end();
    } else if (req.url === '/login') {
      res.end('Đăng nhập quản trị<script src="/_next/app.js"></script>');
    } else if (['/_next/app.js', '/icon.svg', '/manifest.webmanifest'].includes(req.url)) {
      res.end('asset');
    } else {
      res.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const site = `http://127.0.0.1:${server.address().port}`;
  const output = [];
  const run = () =>
    checkStack({
      site: `${site}/`,
      api: `${site}/api/v1/`,
      timeoutMs: 250,
      report: (line) => output.push(line),
    });
  return { run, output, requests };
}

test('single-domain routing checks public device API and assets', async (t) => {
  const { run, requests } = await fixture(t);
  assert.equal(await run(), true);
  assert.ok(requests.includes('/api/v1/devices'));
  assert.ok(requests.includes('/_next/app.js'));
  assert.ok(!requests.includes('/api/v1/admin/audit-logs'));
});

test('database failure reports guidance without disclosing body and continues web checks', async (t) => {
  const { run, output, requests } = await fixture(t, {
    '/api/v1/health/ready': (res) => res.writeHead(503).end('private-database-credential'),
  });
  assert.equal(await run(), false);
  assert.match(output.join('\n'), /FAIL: API health\/ready.*PostgreSQL/);
  assert.ok(!output.join('\n').includes('private-database-credential'));
  assert.ok(requests.includes('/manifest.webmanifest'));
});

test('stalled asset body times out and remaining checks complete', async (t) => {
  const { run, output, requests } = await fixture(t, {
    '/_next/app.js': (res) => {
      res.writeHead(200);
      res.write('partial');
    },
  });
  assert.equal(await run(), false);
  assert.match(output.join('\n'), /FAIL: Trang login/);
  assert.ok(requests.includes('/manifest.webmanifest'));
});

test('unexpected redirect on an asset is not silently followed', async (t) => {
  const { run } = await fixture(t, {
    '/_next/app.js': (res) => res.writeHead(302, { location: '/login' }).end(),
  });
  assert.equal(await run(), false);
});

test('URL containing credentials is rejected before any request', async () => {
  await assert.rejects(checkStack({ site: 'http://user:secret@localhost' }));
});
