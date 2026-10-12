import { describe, expect, it } from 'vitest';
import { success } from '@automation/contracts';
import { getPlatformStatus } from '../src/lib/platform-status';

const requestId = 'd1b26b3a-2611-4d8d-90ad-379c099b5f0a';
const healthy = {
  service: 'backend',
  status: 'ok',
  timestamp: new Date().toISOString(),
  database: 'up',
};
describe('dashboard status', () => {
  it('reads real API/DB status instead of treating any response as success', async () => {
    const fetcher: typeof fetch = async (url) =>
      String(url).endsWith('ready')
        ? new Response('{}', { status: 503 })
        : Response.json(success(healthy, requestId));
    expect(await getPlatformStatus('http://localhost:4000/api/v1', fetcher)).toMatchObject({
      api: true,
      database: false,
    });
  });
  it('fails closed for malformed health responses and disconnected API', async () => {
    expect(
      await getPlatformStatus('http://localhost:4000/api/v1', async () =>
        Response.json({ success: true }),
      ),
    ).toMatchObject({ api: false, database: false });
    expect(
      await getPlatformStatus('http://localhost:4000/api/v1', async () => {
        throw new Error('offline');
      }),
    ).toMatchObject({ api: false, database: false });
  });
});
