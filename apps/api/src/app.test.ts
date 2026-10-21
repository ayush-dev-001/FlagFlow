import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createPrisma, type PrismaClient } from './db.js';
import type { Redis } from './redis.js';
import { connectTestDb, connectTestRedis, DASHBOARD_ORIGIN, deadRedis, testDeps } from './test/helpers.js';

let prisma: PrismaClient;
let redis: Redis;

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

const app = () => createApp(testDeps(prisma, redis));

describe('GET /api/health', () => {
  it('is ok when Postgres and Redis respond', async () => {
    const res = await request(app()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { postgres: 'ok', redis: 'ok' } });
  });

  it('is 503 when Redis is down', async () => {
    const res = await request(createApp(testDeps(prisma, deadRedis()))).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { postgres: 'ok', redis: 'error' } });
  });

  it('is 503 when Postgres is down', async () => {
    const deadDb = createPrisma('postgresql://flagflow:flagflow@127.0.0.1:5999/none');
    const res = await request(createApp(testDeps(deadDb, redis))).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ postgres: 'error', redis: 'ok' });
  });
});

describe('errors', () => {
  it('returns the standard shape for unknown routes', async () => {
    const res = await request(app()).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app())
      .post('/api/anything')
      .set('content-type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('rejects bodies over 100kb', async () => {
    const res = await request(app())
      .post('/api/anything')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(110_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('request ids', () => {
  it('reuses a safe incoming id', async () => {
    const res = await request(app()).get('/api/health').set('x-request-id', 'trace-123');
    expect(res.headers['x-request-id']).toBe('trace-123');
  });

  it('replaces an unsafe incoming id', async () => {
    const res = await request(app()).get('/api/health').set('x-request-id', '<script>');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('headers and CORS', () => {
  it('sets security headers and hides Express', async () => {
    const res = await request(app()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('allows the dashboard origin with credentials', async () => {
    const res = await request(app()).get('/api/health').set('origin', DASHBOARD_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(DASHBOARD_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow other origins', async () => {
    const res = await request(app()).get('/api/health').set('origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});
