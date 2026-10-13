import { afterEach, expect, it, vi } from 'vitest';
import { proxyDevices } from '../src/features/devices/proxy';
const origin = 'https://app.example.test',
  base = 'https://api.example.test/api/v1';
afterEach(() => vi.unstubAllGlobals());
it('limits device proxy paths, rejects foreign Origin and forwards session/CSRF only', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  expect((await proxyDevices(new Request(origin), ['../agent/pair'], base, origin)).status).toBe(
    404,
  );
  const post = (source: string) =>
    new Request(origin, {
      method: 'POST',
      headers: {
        Origin: source,
        'Content-Type': 'application/json',
        Cookie: `tracking=secret; automation_session=${'a'.repeat(64)}`,
        'X-CSRF-Token': 'b'.repeat(43),
        Authorization: 'Bearer never-forward',
      },
      body: '{}',
    });
  expect(
    (await proxyDevices(post('https://foreign.example'), ['pairing-code'], base, origin)).status,
  ).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await proxyDevices(post(origin), ['pairing-code'], base, origin)).status).toBe(200);
  expect(String(fetcher.mock.calls[0]![0])).toBe(`${base}/devices/pairing-code`);
  expect(fetcher.mock.calls[0]![1].headers.get('Authorization')).toBeNull();
  expect(fetcher.mock.calls[0]![1].headers.get('Cookie')).toBe(
    `automation_session=${'a'.repeat(64)}`,
  );
});
