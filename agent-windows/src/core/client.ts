import { z } from 'zod';
import {
  devicePairResponseSchema,
  deviceIdentityResponseSchema,
  heartbeatResponseSchema,
  type AgentMetadata,
  type DeviceIdentity,
} from '@automation/contracts';
import type { AgentConfig } from '../config.js';

export class AgentApiError extends Error {
  constructor(readonly status: number) {
    super('AGENT_API_ERROR');
  }
}
export interface DeviceClient {
  pair(
    input: AgentMetadata & { code: string; label: string },
  ): Promise<DeviceIdentity & { token: string }>;
  heartbeat(
    token: string,
    metadata: AgentMetadata,
  ): Promise<{ deviceId: string; serverTime: string; heartbeatAfterSeconds: number }>;
  stage(token: string, nextToken: string): Promise<DeviceIdentity>;
  commit(token: string): Promise<DeviceIdentity>;
}
export class HttpDeviceClient implements DeviceClient {
  constructor(
    private readonly config: AgentConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private async post<T extends z.ZodType>(
    path: string,
    input: unknown,
    schema: T,
    token?: string,
  ): Promise<z.output<T>> {
    const response = await this.fetcher(
      `${this.config.AGENT_API_BASE_URL.replace(/\/$/, '')}/agent/${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(input),
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.AGENT_REQUEST_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new AgentApiError(response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('INVALID_RESPONSE');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) {
        await reader.cancel();
        throw new Error('RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
    const parsed = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (!parsed.success) throw new Error('INVALID_RESPONSE');
    return parsed.data;
  }
  async pair(input: AgentMetadata & { code: string; label: string }) {
    const body = await this.post('pair', input, devicePairResponseSchema);
    if (!body.success) throw new Error('INVALID_RESPONSE');
    return body.data;
  }
  async heartbeat(token: string, metadata: AgentMetadata) {
    const body = await this.post('heartbeat', metadata, heartbeatResponseSchema, token);
    if (!body.success) throw new Error('INVALID_RESPONSE');
    return body.data;
  }
  async stage(token: string, nextToken: string) {
    const body = await this.post(
      'credentials/rotate',
      { token: nextToken },
      deviceIdentityResponseSchema,
      token,
    );
    if (!body.success) throw new Error('INVALID_RESPONSE');
    return body.data;
  }
  async commit(token: string) {
    const body = await this.post('credentials/commit', {}, deviceIdentityResponseSchema, token);
    if (!body.success) throw new Error('INVALID_RESPONSE');
    return body.data;
  }
}
