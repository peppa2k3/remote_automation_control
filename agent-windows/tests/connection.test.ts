import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { parseAgentConfig } from '../src/config.js';
import { HttpDeviceClient, AgentApiError, type DeviceClient } from '../src/core/client.js';
import { rotateCredential, runHeartbeat } from '../src/core/connection.js';
import type { CredentialStore, LocalCredential } from '../src/core/credential-store.js';

const metadata = {
  platform: 'win32' as const,
  arch: 'x64' as const,
  version: '0.1.0',
  capabilities: ['heartbeat' as const],
};
function fixture() {
  let value: LocalCredential = {
    version: 1,
    apiBaseUrl: 'https://api.example.test/api/v1',
    token: `agt_${'a'.repeat(64)}`,
    identity: {
      deviceId: randomUUID(),
      scopes: ['agent:heartbeat', 'agent:rotate'],
      credentialExpiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  };
  const store: CredentialStore = {
    load: async () => structuredClone(value),
    save: async (next) => {
      value = structuredClone(next);
    },
  };
  const client: DeviceClient = {
    pair: vi.fn(),
    heartbeat: vi.fn().mockImplementation(async () => ({
      deviceId: value.identity.deviceId,
      serverTime: new Date().toISOString(),
      heartbeatAfterSeconds: 30,
    })),
    stage: vi.fn().mockImplementation(async () => value.identity),
    commit: vi.fn().mockImplementation(async () => value.identity),
  };
  return { store, client };
}
describe('outbound Agent recovery', () => {
  it('retains staged credential after lost response and resumes the exact same rotation', async () => {
    const { store, client } = fixture();
    const current = (await store.load())!;
    vi.mocked(client.commit).mockRejectedValueOnce(new Error('connection lost'));
    await expect(rotateCredential(store, client, current)).rejects.toThrow();
    const pending = (await store.load())!;
    expect(pending.pendingToken).toMatch(/^agt_[a-f0-9]{64}$/);
    expect(pending.token).toBe(current.token);
    vi.mocked(client.stage).mockRejectedValueOnce(new AgentApiError(401));
    const recovered = await rotateCredential(store, client, pending);
    expect(recovered.token).toBe(pending.pendingToken);
    expect(recovered.pendingToken).toBeUndefined();
    expect(client.commit).toHaveBeenLastCalledWith(pending.pendingToken);
  });
  it('never changes server credentials when persisting the pending token fails', async () => {
    const { store, client } = fixture(),
      current = (await store.load())!;
    store.save = async () => {
      throw new Error('disk full');
    };
    await expect(rotateCredential(store, client, current)).rejects.toThrow();
    expect(client.stage).not.toHaveBeenCalled();
  });
  it('backs off transient failures, reconnects and stops on revocation without logging token', async () => {
    const { store, client } = fixture();
    const token = (await store.load())!.token;
    vi.mocked(client.heartbeat)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new AgentApiError(503))
      .mockResolvedValueOnce({
        deviceId: (await store.load())!.identity.deviceId,
        serverTime: new Date().toISOString(),
        heartbeatAfterSeconds: 30,
      })
      .mockRejectedValueOnce(new AgentApiError(401));
    const waits: number[] = [],
      events: unknown[] = [];
    await expect(
      runHeartbeat(store, client, metadata, {
        signal: new AbortController().signal,
        log: (e) => events.push(e),
        random: () => 0.5,
        sleep: async (ms) => {
          waits.push(ms);
        },
      }),
    ).rejects.toThrow('PAIRING_REQUIRED');
    expect(waits).toEqual([1000, 2000, 30000]);
    expect(events).toMatchObject([
      { event: 'agent.reconnecting' },
      { event: 'agent.reconnecting' },
      { event: 'agent.connected' },
      { event: 'agent.auth_rejected' },
    ]);
    expect(JSON.stringify(events)).not.toContain(token);
  });
  it('rejects TLS bypass and redirects, bounds responses and strips upstream error detail', async () => {
    expect(() =>
      parseAgentConfig({
        AGENT_API_BASE_URL: 'https://api.example.test',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
      }),
    ).toThrow();
    const config = parseAgentConfig({ AGENT_API_BASE_URL: 'https://api.example.test/api/v1' });
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('private-secret-error', { status: 401 }));
    const client = new HttpDeviceClient(config, fetcher);
    await expect(client.heartbeat(`agt_${'a'.repeat(64)}`, metadata)).rejects.toMatchObject({
      status: 401,
      message: 'AGENT_API_ERROR',
    });
    expect(fetcher.mock.calls[0]![1].redirect).toBe('error');
    fetcher.mockResolvedValueOnce(new Response('x'.repeat(65537)));
    await expect(client.heartbeat(`agt_${'a'.repeat(64)}`, metadata)).rejects.toThrow(
      'RESPONSE_TOO_LARGE',
    );
  });
});
