import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyAuth } from '../src/features/auth/proxy';

const site = 'http://localhost:3000';
const base = 'http://localhost:4000/api/v1';
function post(headers: Record<string, string> = {}, body = '{}') {
  return new Request(`${site}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Origin: site, 'Content-Type': 'application/json', ...headers },
    body,
  });
}
afterEach(() => vi.unstubAllGlobals());
describe('same-origin auth proxy', () => {
  it('rejects foreign origins, unsupported actions and non-JSON without contacting backend', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await proxyAuth(post({ Origin: 'https://foreign.example' }), 'login', base, site)).status,
    ).toBe(403);
    expect(
      (await proxyAuth(post({ 'Sec-Fetch-Site': 'cross-site' }), 'login', base, site)).status,
    ).toBe(403);
    expect((await proxyAuth(post(), '../admin', base, site)).status).toBe(404);
    expect(
      (await proxyAuth(post({ 'Content-Type': 'text/plain' }), 'login', base, site)).status,
    ).toBe(415);
    expect((await proxyAuth(post(), 'login', 'file:///private', site)).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds streamed bytes even with misleading Content-Length', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await proxyAuth(post({ 'Content-Length': '1' }, 'x'.repeat(32769)), 'login', base, site))
        .status,
    ).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards only the session cookie and valid CSRF and preserves cookie security', async () => {
    const token = 'a'.repeat(64),
      csrf = 'b'.repeat(43);
    const cookie = `automation_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`;
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { headers: { 'Set-Cookie': cookie, 'X-Request-Id': 'correlation' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const response = await proxyAuth(
      post({
        Cookie: `tracking=private; automation_session=${token}`,
        'X-CSRF-Token': csrf,
        Authorization: 'do-not-forward',
      }),
      'refresh',
      base,
      site,
    );
    const [url, options] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`${base}/auth/refresh`);
    expect(options.headers.get('Cookie')).toBe(`automation_session=${token}`);
    expect(options.headers.get('Authorization')).toBeNull();
    expect(options.headers.get('X-CSRF-Token')).toBe(csrf);
    expect(options.redirect).toBe('error');
    expect(response.headers.get('Set-Cookie')).toBe(cookie);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Request-Id')).toBe('correlation');
  });
  it('drops duplicate cookies and returns a sanitized upstream failure', async () => {
    const token = 'a'.repeat(64);
    const fetcher = vi.fn().mockRejectedValue(new Error('private-password internal-url'));
    vi.stubGlobal('fetch', fetcher);
    const response = await proxyAuth(
      post({ Cookie: `automation_session=${token}; automation_session=${token}` }),
      'login',
      base,
      site,
    );
    expect(fetcher.mock.calls[0]![1].headers.get('Cookie')).toBeNull();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-password');
  });
});
