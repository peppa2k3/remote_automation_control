import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function checkStack({
  api = 'http://localhost:4000/api/v1',
  site = 'http://localhost:3000',
  timeoutMs = 10_000,
  report = console.log,
} = {}) {
  for (const value of [api, site]) {
    const url = new URL(value);
    assert.ok(['http:', 'https:'].includes(url.protocol));
    assert.ok(!url.username && !url.password && !url.search && !url.hash);
  }
  api = api.replace(/\/+$/, '');
  site = site.replace(/\/+$/, '');
  let failures = 0;
  async function check(label, hint, action) {
    try {
      await action();
      report(`PASS: ${label}`);
    } catch {
      failures++;
      // Never print response bodies, environment values or raw network errors.
      report(`FAIL: ${label}. ${hint}`);
    }
  }
  async function request(url, status, format = 'text') {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text(); // Deadline also covers stalled response bodies.
    assert.equal(response.status, status);
    return { response, body: format === 'json' ? JSON.parse(body) : body };
  }
  for (const endpoint of ['live', 'ready']) {
    await check(
      `API health/${endpoint}`,
      endpoint === 'ready'
        ? 'Kiểm tra PostgreSQL, migration và DATABASE_URL của backend.'
        : 'Kiểm tra backend, URL API và route /api/v1/health/* của proxy.',
      async () => {
        const { response, body } = await request(`${api}/health/${endpoint}`, 200, 'json');
        assert.equal(body.success, true);
        assert.ok(body.requestId);
        assert.equal(body.requestId, response.headers.get('x-request-id'));
        if (endpoint === 'ready') assert.equal(body.data.database, 'up');
      },
    );
  }
  await check(
    'Dashboard yêu cầu đăng nhập',
    'Kiểm tra frontend và route / của proxy.',
    async () => {
      const { response } = await request(site, 307);
      assert.equal(response.headers.get('location'), '/login');
    },
  );
  await check(
    'Device API từ chối khách chưa đăng nhập',
    'Route /api/v1/devices phải tới Next; kiểm tra kết nối Next → backend.',
    async () => {
      await request(`${site}/api/v1/devices`, 401);
    },
  );
  await check(
    'Trang login và JS/CSS',
    'Kiểm tra frontend build, static assets và route tới Next.',
    async () => {
      const { body: html } = await request(`${site}/login`, 200);
      assert.ok(html.includes('Đăng nhập quản trị'));
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g)].map(
            (match) => match[1],
          ),
        ),
      ];
      assert.ok(assets.some((asset) => asset.includes('/_next/')));
      for (const asset of assets) {
        const url = new URL(asset, site);
        assert.equal(url.origin, new URL(site).origin);
        await request(url, 200);
      }
    },
  );
  for (const path of ['/icon.svg', '/manifest.webmanifest']) {
    await check(path, 'Kiểm tra static assets của frontend.', () => request(`${site}${path}`, 200));
  }
  report(
    failures
      ? `Có ${failures} bước lỗi. Xem docs/guides/verification.md.`
      : 'Kết nối web → API → database đạt kiểm tra. Tiếp tục pair/start Agent và kiểm tra /devices.',
  );
  return failures === 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = (await checkStack({
      api: process.env.CHECK_API_BASE_URL,
      site: process.env.CHECK_SITE_URL,
    }))
      ? 0
      : 1;
  } catch {
    console.error(
      'Cấu hình URL không hợp lệ. Dùng URL HTTP(S) không chứa tài khoản, query hoặc fragment.',
    );
    process.exitCode = 1;
  }
}
