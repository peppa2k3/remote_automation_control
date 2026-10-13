import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DpapiCredentialStore, type LocalCredential } from '../src/core/credential-store.js';

async function cleanup(root: string, directory: string) {
  const target = resolve(directory);
  if (!target.startsWith(`${root}\\005-dpapi-`)) throw new Error('Unsafe cleanup path');
  await rm(target, { recursive: true, force: true });
}

describe.skipIf(process.platform !== 'win32')('real Windows DPAPI CurrentUser', () => {
  it('encrypts identity, serializes processes, replaces atomically and rejects tampering', async () => {
    const root = resolve(import.meta.dirname, '../../.verification');
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(join(root, '005-dpapi-'));
    const store = new DpapiCredentialStore(directory),
      second = new DpapiCredentialStore(directory);
    const value: LocalCredential = {
      version: 1,
      apiBaseUrl: 'https://api.example.test/api/v1',
      token: `agt_${'a'.repeat(64)}`,
      identity: {
        deviceId: randomUUID(),
        scopes: ['agent:heartbeat', 'agent:rotate'],
        credentialExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    };
    try {
      await store.exclusive(async () => {
        expect(await store.load()).toBeNull();
        await store.save(value);
        expect(await store.load()).toEqual(value);
        const encrypted = await readFile(store.file, 'utf8');
        expect(encrypted).not.toContain(value.token);
        expect(encrypted).not.toContain(value.identity.deviceId);
        expect(encrypted).not.toContain('api.example.test');
        await expect(second.exclusive(async () => {})).rejects.toThrow('STORE_BUSY');
        const updated = { ...value, pendingToken: `agt_${'b'.repeat(64)}` };
        await store.save(updated);
        expect(await store.load()).toEqual(updated);
      });
      await second.exclusive(async () => {
        expect((await second.load())?.pendingToken).toBe(`agt_${'b'.repeat(64)}`);
        const ciphertext = await readFile(second.file, 'utf8');
        await writeFile(second.file, `AAAA${ciphertext.slice(4)}`, 'utf8');
        await expect(second.load()).rejects.toThrow('CREDENTIAL_UNAVAILABLE');
      });
    } finally {
      await cleanup(root, directory);
    }
  }, 45_000);
});
