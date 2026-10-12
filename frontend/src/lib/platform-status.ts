import { healthResponseSchema } from '@automation/contracts';

export interface PlatformStatus {
  api: boolean;
  database: boolean;
  checkedAt: string;
}

export async function getPlatformStatus(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<PlatformStatus> {
  async function check(path: string, requiresDatabase = false) {
    try {
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/${path}`);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
      const response = await fetcher(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) return false;
      const body = healthResponseSchema.safeParse(await response.json());
      return (
        body.success && body.data.success && (!requiresDatabase || body.data.data.database === 'up')
      );
    } catch {
      return false;
    }
  }
  const [api, database] = await Promise.all([check('health/live'), check('health/ready', true)]);
  return { api, database, checkedAt: new Date().toISOString() };
}
