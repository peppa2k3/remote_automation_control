import assert from 'node:assert/strict';

const api = process.env.CHECK_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const site = process.env.CHECK_SITE_URL ?? 'http://localhost:3000';
for (const endpoint of ['live', 'ready']) {
  const response = await fetch(`${api}/health/${endpoint}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `Health ${endpoint} is unavailable`);
  assert.equal(body.success, true);
  assert.equal(body.requestId, response.headers.get('x-request-id'));
  if (endpoint === 'ready') assert.equal(body.data.database, 'up');
  console.log(`PASS: stack health/${endpoint}`);
}
const anonymous = await fetch(site, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
assert.equal(anonymous.status, 307);
assert.equal(anonymous.headers.get('location'), '/login');
assert.equal((await fetch(`${api}/admin/audit-logs`)).status, 401);
const page = await fetch(`${site}/login`, { signal: AbortSignal.timeout(10_000) });
assert.equal(page.status, 200);
const html = await page.text();
assert.ok(html.includes('Đăng nhập quản trị'));
for (const path of ['/icon.svg', '/manifest.webmanifest']) {
  assert.equal((await fetch(`${site}${path}`)).status, 200);
}
const assets = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g)].map(
      (match) => match[1],
    ),
  ),
];
assert.ok(
  assets.some((asset) => asset.includes('/_next/')),
  'No Next.js build assets found',
);
for (const asset of assets) {
  assert.equal((await fetch(new URL(asset, site))).status, 200, 'Build asset unavailable');
}
console.log(
  'PASS: protected dashboard redirects, login page, manifest, icon and JS/CSS assets are served',
);
