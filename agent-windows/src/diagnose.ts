import { healthResponseSchema } from '@automation/contracts';
import type { AgentConfig } from './config.js';

export async function diagnose(config: AgentConfig, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${config.AGENT_API_BASE_URL.replace(/\/$/, '')}/health/live`, {
    signal: AbortSignal.timeout(config.AGENT_REQUEST_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('API_UNAVAILABLE');
  const body = healthResponseSchema.safeParse(await response.json());
  if (!body.success || !body.data.success) throw new Error('INVALID_API_RESPONSE');
  return { status: 'connected' as const, requestId: body.data.requestId };
}
