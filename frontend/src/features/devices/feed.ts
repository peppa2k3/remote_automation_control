import { devicesResponseSchema } from '@automation/contracts';

export async function readDeviceFeed(signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const response = await fetcher('/api/v1/devices', { cache: 'no-store', signal });
  const body = devicesResponseSchema.safeParse(await response.json());
  if (!response.ok || !body.success || !body.data.success) throw new Error('FEED_UNAVAILABLE');
  return body.data.data;
}
