import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createDatabase } from '../../src/database.js';
import { createApp } from '../../src/app.js';

const enabled = process.env.RUN_DB_TESTS === '1';
const db = enabled ? createDatabase(process.env.DATABASE_URL ?? '') : undefined;

describe.skipIf(!enabled)('isolated PostgreSQL integration', () => {
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('uses the committed migration for Prisma write/read/delete', async () => {
    if (!db) throw new Error('Database tests require explicit opt-in');
    const label = `integration-${randomUUID()}`;
    const record = await db.systemCheck.create({ data: { label } });
    try {
      expect(await db.systemCheck.findUnique({ where: { id: record.id } })).toMatchObject({
        label,
      });
      await expect(db.systemCheck.create({ data: { label } })).rejects.toThrow();
    } finally {
      await db.systemCheck.delete({ where: { id: record.id } });
    }
  });

  it('returns actual database readiness via HTTP', async () => {
    if (!db) throw new Error('Database tests require explicit opt-in');
    const app = createApp({
      frontendOrigin: 'http://localhost:3000',
      checkDatabase: async () => {
        await db.$queryRaw`SELECT 1`;
      },
    });
    const response = await request(app).get('/api/v1/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.data.database).toBe('up');
  });

  it('fails closed when the actual database cannot be reached', async () => {
    const unavailable = createDatabase('postgresql://invalid:invalid@127.0.0.1:1/unavailable');
    try {
      const app = createApp({
        frontendOrigin: 'http://localhost:3000',
        checkDatabase: async () => {
          await unavailable.$queryRaw`SELECT 1`;
        },
      });
      expect((await request(app).get('/api/v1/health/ready')).status).toBe(503);
      expect((await request(app).get('/api/v1/health/live')).status).toBe(200);
    } finally {
      await unavailable.$disconnect();
    }
  }, 15_000);
});
