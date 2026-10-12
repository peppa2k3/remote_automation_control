import { describe, expect, it } from 'vitest';
import { success } from '@automation/contracts';
import { parseAgentConfig } from '../src/config.js';
import { diagnose } from '../src/diagnose.js';

const config = parseAgentConfig({ AGENT_API_BASE_URL: 'https://api.example.com/api/v1' });
describe('outbound Agent diagnostics', () => {
  it('requires HTTPS and rejects remote HTTP or URL credentials', () => {
    for (const url of [
      'http://api.example.com',
      'ftp://api.example.com',
      'https://user:secret@api.example.com',
      'https://api.example.com?token=secret',
    ]) {
      expect(() =>
        parseAgentConfig({ AGENT_API_BASE_URL: url, AGENT_ALLOW_LOCAL_HTTP: 'true' }),
      ).toThrow();
    }
    expect(() =>
      parseAgentConfig({
        AGENT_API_BASE_URL: 'http://localhost:4000',
        AGENT_ALLOW_LOCAL_HTTP: 'true',
      }),
    ).not.toThrow();
    expect(() => parseAgentConfig({ AGENT_API_BASE_URL: 'http://localhost:4000' })).toThrow();
  });
  it('accepts only a validated backend health envelope', async () => {
    const requestId = 'd1b26b3a-2611-4d8d-90ad-379c099b5f0a';
    await expect(
      diagnose(config, async () =>
        Response.json(
          success(
            { service: 'backend', status: 'ok', timestamp: new Date().toISOString() },
            requestId,
          ),
        ),
      ),
    ).resolves.toMatchObject({ status: 'connected', requestId });
    await expect(diagnose(config, async () => Response.json({ success: true }))).rejects.toThrow(
      'INVALID_API_RESPONSE',
    );
    await expect(diagnose(config, async () => new Response('', { status: 503 }))).rejects.toThrow(
      'API_UNAVAILABLE',
    );
  });
  it('sets bounded request timeout and refuses redirects', async () => {
    await expect(
      diagnose(config, async (_url, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.redirect).toBe('error');
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
  });
});
