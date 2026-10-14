import { expect, it, vi } from 'vitest';
import { readDeviceFeed } from '../src/features/devices/feed';

it.each([401, 403, 503])('does not expose stale data after an HTTP %i', async (status) => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: false }), { status }));
  await expect(readDeviceFeed(new AbortController().signal, fetcher)).rejects.toThrow();
});
it('rejects a disconnected or malformed feed instead of inventing offline devices', async () => {
  await expect(
    readDeviceFeed(new AbortController().signal, vi.fn().mockRejectedValue(new Error('network'))),
  ).rejects.toThrow();
  await expect(
    readDeviceFeed(new AbortController().signal, vi.fn().mockResolvedValue(new Response('{}'))),
  ).rejects.toThrow();
});
