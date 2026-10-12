import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { healthResponseSchema } from '@automation/contracts';
import { createApp } from '../../src/app.js';
import { parseConfig } from '../../src/config.js';

const makeApp = (checkDatabase = async () => {}) =>
  createApp({ frontendOrigin: 'http://localhost:3000', checkDatabase });
describe('health and HTTP boundaries', () => {
  it('keeps liveness up when database fails, and never returns the database secret', async () => {
    const app = makeApp(async () => {
      throw new Error('password=super-secret');
    });
    const live = await request(app).get('/api/v1/health/live').set('X-Request-Id', 'untrusted');
    expect(live.status).toBe(200);
    expect(healthResponseSchema.safeParse(live.body).success).toBe(true);
    expect(live.headers['x-request-id']).toBe(live.body.requestId);
    expect(live.headers['x-request-id']).not.toBe('untrusted');
    const ready = await request(app).get('/api/v1/health/ready');
    expect(ready.status).toBe(503);
    expect(ready.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(ready.text).not.toContain('super-secret');
    expect(ready.headers['cache-control']).toBe('no-store');
  });
  it('reports readiness only when injected database check succeeds', async () => {
    const response = await request(makeApp()).get('/api/v1/health/ready');
    expect(response.status).toBe(200);
    expect(response.body.data.database).toBe('up');
  });
  it('rejects malformed/oversized bodies and routes that have not been built', async () => {
    const app = makeApp();
    expect((await request(app).post('/api/v1/runs').send({})).status).toBe(404);
    const malformed = await request(app)
      .post('/api/v1/runs')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_JSON');
    expect(
      (
        await request(app)
          .post('/api/v1/runs')
          .send({ data: 'x'.repeat(40_000) })
      ).status,
    ).toBe(413);
  });
  it('restricts CORS and suppresses framework header', async () => {
    const response = await request(makeApp())
      .get('/api/v1/health/live')
      .set('Origin', 'https://untrusted.example.com');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('rate limits with a valid safe error envelope', async () => {
    const app = createApp({
      frontendOrigin: 'http://localhost:3000',
      checkDatabase: async () => {},
      rateLimitMax: 1,
    });
    await request(app).get('/api/v1/health/live');
    const response = await request(app).get('/api/v1/health/live');
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(healthResponseSchema.safeParse(response.body).success).toBe(true);
  });
  it('rejects unsafe production config and invalid port before startup', () => {
    expect(() => parseConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => parseConfig({ PORT: '0' })).toThrow();
    expect(parseConfig({}).HOST).toBe('127.0.0.1');
  });
});
