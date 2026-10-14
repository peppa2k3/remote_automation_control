import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { AgentMetadata } from '@automation/contracts';
import { AgentApiError, type DeviceClient } from './client.js';
import type { CredentialStore, LocalCredential } from './credential-store.js';
import { runtimeSnapshot } from './runtime.js';

export async function rotateCredential(
  store: CredentialStore,
  client: DeviceClient,
  current: LocalCredential,
) {
  const pending = current.pendingToken ?? `agt_${randomBytes(32).toString('hex')}`;
  const staged = { ...current, pendingToken: pending };
  // Persist before any server change, so response loss never discards the next credential.
  await store.save(staged);
  try {
    await client.stage(current.token, pending);
  } catch (error) {
    // Commit may already have succeeded before a lost response/restart.
    if (!(error instanceof AgentApiError) || error.status !== 401) throw error;
  }
  const identity = await client.commit(pending);
  if (identity.deviceId !== current.identity.deviceId) throw new Error('DEVICE_ID_MISMATCH');
  const next: LocalCredential = {
    version: 1,
    apiBaseUrl: current.apiBaseUrl,
    token: pending,
    identity,
  };
  await store.save(next);
  return next;
}
export type ConnectionEvent = {
  event: 'agent.connected' | 'agent.reconnecting' | 'agent.auth_rejected' | 'agent.rotated';
  deviceId: string;
  requestDelayMs?: number;
};
export interface LoopOptions {
  signal: AbortSignal;
  log: (event: ConnectionEvent) => void;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
  clock?: () => number;
}
export async function runHeartbeat(
  store: CredentialStore,
  client: DeviceClient,
  metadata: AgentMetadata,
  options: LoopOptions,
) {
  let current = await store.load();
  if (!current) throw new Error('PAIRING_REQUIRED');
  const sleep = options.sleep ?? ((ms, signal) => delay(ms, undefined, { signal }));
  const random = options.random ?? Math.random,
    now = options.clock ?? Date.now;
  let failures = 0,
    connected = false;
  while (!options.signal.aborted) {
    let wait: number;
    try {
      if (
        current.pendingToken ||
        Date.parse(current.identity.credentialExpiresAt) - now() < 6 * 60 * 60 * 1000
      ) {
        current = await rotateCredential(store, client, current);
        options.log({ event: 'agent.rotated', deviceId: current.identity.deviceId });
      }
      const heartbeat = await client.heartbeat(current.token, {
        ...metadata,
        runtime: runtimeSnapshot(),
      });
      if (heartbeat.deviceId !== current.identity.deviceId) throw new Error('DEVICE_ID_MISMATCH');
      if (!connected)
        options.log({ event: 'agent.connected', deviceId: current.identity.deviceId });
      connected = true;
      failures = 0;
      wait = heartbeat.heartbeatAfterSeconds * 1000;
    } catch (error) {
      // A failed rotation may have saved a pending token; reload it rather than generate another.
      current = await store.load();
      if (!current) throw new Error('CREDENTIAL_UNAVAILABLE', { cause: error });
      if (error instanceof AgentApiError && [401, 403, 409].includes(error.status)) {
        options.log({ event: 'agent.auth_rejected', deviceId: current.identity.deviceId });
        throw new Error('PAIRING_REQUIRED', { cause: error });
      }
      failures++;
      connected = false;
      wait = Math.round(
        Math.min(60_000, 1000 * 2 ** Math.min(failures - 1, 6)) * (0.75 + random() * 0.5),
      );
      options.log({
        event: 'agent.reconnecting',
        deviceId: current.identity.deviceId,
        requestDelayMs: wait,
      });
    }
    try {
      await sleep(wait, options.signal);
    } catch (error) {
      if (!options.signal.aborted) throw new Error('WAIT_FAILED', { cause: error });
    }
  }
}
