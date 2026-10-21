// Phase 1 attack tests: the only route is /api/health, so these cover the layers every later route sits behind:
// body parsing, error rendering, CORS, headers and request-id handling.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import type { PrismaClient } from '../apps/api/src/db.js';
import type { Redis } from '../apps/api/src/redis.js';
import { connectTestDb, connectTestRedis, DASHBOARD_ORIGIN, testDeps } from '../apps/api/src/test/helpers.js';

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

const LEAK = /stack|at \w+ \(|node_modules|prisma|postgres|redis:\/\/|Error:/i;

describe('error responses leak nothing', () => {
  const payloads: [string, string][] = [
    ['truncated JSON', '{"a":'],
    ['non-JSON', 'hello'],
    ['deep nesting', '['.repeat(5000) + ']'.repeat(5000)],
    ['NUL bytes', '{"a":"\u0000"}x'],
  ];
  for (const [name, body] of payloads) {
    it(`rejects ${name} cleanly`, async () => {
      const res = await request(app()).post('/api/health').set('content-type', 'application/json').send(body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body.error).toHaveProperty('code');
      expect(res.text).not.toMatch(LEAK);
    });
  }

  it('does not let __proto__ in a body pollute Object.prototype', async () => {
    await request(app())
      .post('/api/anything')
      .set('content-type', 'application/json')
      .send('{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"isAdmin":true}}}');
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it('health exposes status only, no versions or error text', async () => {
    const res = await request(app()).get('/api/health');
    // Exact shape: component names with ok/error only, nothing else.
    expect(res.body).toEqual({ status: 'ok', checks: { postgres: 'ok', redis: 'ok' } });
  });
});

describe('oversized bodies', () => {
  it('rejects a 1 MB JSON body with 413', async () => {
    const res = await request(app())
      .post('/api/anything')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ x: 'a'.repeat(1_000_000) }));
    expect(res.status).toBe(413);
  });

  it('rejects an oversized body that lies about its content-type casing', async () => {
    const res = await request(app())
      .post('/api/anything')
      .set('content-type', 'Application/JSON; charset=utf-8')
      .send(JSON.stringify({ x: 'a'.repeat(200_000) }));
    expect(res.status).toBe(413);
  });
});

describe('CORS', () => {
  for (const origin of [
    'https://evil.example',
    'null',
    `${DASHBOARD_ORIGIN}.evil.example`,
    'http://localhost:5174',
  ]) {
    it(`does not grant ${origin}`, async () => {
      const res = await request(app()).get('/api/health').set('origin', origin);
      expect(res.headers['access-control-allow-origin']).not.toBe(origin);
    });
  }

  it('preflight from a foreign origin is not allowed', async () => {
    const res = await request(app())
      .options('/api/health')
      .set('origin', 'https://evil.example')
      .set('access-control-request-method', 'POST');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  it('/v1 sends no CORS headers even to the dashboard origin', async () => {
    const res = await request(app()).get('/v1/flags/evaluate').set('origin', DASHBOARD_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('header handling', () => {
  it('does not reflect an oversized or crafted x-request-id', async () => {
    for (const id of ['a'.repeat(65), 'abc"><svg onload=1>', '../../etc/passwd']) {
      const res = await request(app()).get('/api/health').set('x-request-id', id);
      expect(res.headers['x-request-id']).not.toBe(id);
    }
  });

  it('sends hardening headers', async () => {
    const res = await request(app()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  });
});

describe('routing', () => {
  for (const path of ['/api/../../etc/passwd', '/api/%2e%2e/%2e%2e/etc/passwd', '/api/health/../admin']) {
    it(`returns a JSON 404 for ${path}`, async () => {
      const res = await request(app()).get(path);
      expect([404]).toContain(res.status);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
    });
  }

  it('does not support TRACE', async () => {
    const res = await request(app()).trace('/api/health');
    expect(res.status).toBe(404);
  });
});
