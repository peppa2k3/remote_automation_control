import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { createDatabase } from '../../src/database.js';

it.skipIf(process.env.RUN_DB_TESTS !== '1')(
  'upgrades populated 005 tables without losing device credentials',
  async () => {
    const db = createDatabase(process.env.DATABASE_URL ?? '');
    const schema = `upgrade_${randomUUID().replaceAll('-', '')}`;
    const ownerId = randomUUID(),
      deviceId = randomUUID(),
      credentialId = randomUUID();
    try {
      await db.$transaction(
        async (tx) => {
          // All tables live in this transaction's isolated schema; public data is untouched.
          await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
          async function migration(name: string) {
            const source = await readFile(
              new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url),
              'utf8',
            );
            // These versioned files contain only plain SQL statements (no procedural blocks).
            for (const statement of source
              .split(';')
              .map((value) => value.trim())
              .filter(Boolean))
              await tx.$executeRawUnsafe(statement);
          }
          await migration('20261013000200_admin_auth');
          await migration('20261013000300_device_pairing');
          await tx.$executeRaw`INSERT INTO users (id, email, "passwordHash", role, "updatedAt") VALUES (${ownerId}::uuid, 'upgrade@example.test', 'unused-test-hash', 'OWNER', NOW())`;
          await tx.$executeRaw`INSERT INTO devices (id, label, platform, arch, version, capabilities, "updatedAt") VALUES (${deviceId}::uuid, 'Existing PC', 'win32', 'x64', '0.1.0', ARRAY['heartbeat'], NOW())`;
          await tx.$executeRaw`INSERT INTO device_credentials (id, "deviceId", "tokenHash", scopes, "expiresAt", "activatedAt") VALUES (${credentialId}::uuid, ${deviceId}::uuid, ${'a'.repeat(64)}, ARRAY['agent:heartbeat'], NOW() + INTERVAL '1 day', NOW())`;
          await migration('20261014000100_device_manager');
          const rows = await tx.$queryRaw<
            { id: string; ownerId: string; runtime: unknown }[]
          >`SELECT id, "ownerId", runtime FROM devices`;
          expect(rows).toEqual([{ id: deviceId, ownerId, runtime: null }]);
          const credentials = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM device_credentials`;
          expect(credentials).toEqual([{ id: credentialId }]);
          await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
        },
        { timeout: 15000 },
      );
    } finally {
      await db.$disconnect();
    }
  },
);
