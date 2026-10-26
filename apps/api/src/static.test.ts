import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { PrismaClient } from './db.js';
import type { Redis } from './redis.js';
import { connectTestDb, connectTestRedis, testDeps } from './test/helpers.js';

let prisma: PrismaClient;
let redis: Redis;
let dist: string;

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
  dist = mkdtempSync(join(tmpdir(), 'ff-dist-'));
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>FlagFlow</title><div id="root"></div>');
  writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
  writeFileSync(join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
});
afterAll(async () => {
  rmSync(dist, { recursive: true, force: true });
  await prisma.$disconnect();
  await redis.quit();
});

describe('serving the dashboard build (DASHBOARD_DIST)', () => {
  const app = () => createApp(testDeps(prisma, redis, { DASHBOARD_DIST: dist }));

  it('serves index.html, uncached, for every dashboard route', async () => {
    for (const path of ['/', '/flags', '/flags/0198-abc', '/invite/some-token', '/welcome']) {
      const res = await request(app()).get(path);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('caches hashed assets for a year, and a missing asset is a 404, not the app', async () => {
    const asset = await request(app()).get('/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    expect((await request(app()).get('/assets/gone-999.js')).status).toBe(404);
    expect((await request(app()).get('/favicon.svg')).status).toBe(200);
  });

  it('leaves the API alone: unknown /api and /v1 paths are JSON 404s', async () => {
    for (const path of ['/api/nope', '/api']) {
      const res = await request(app()).get(path);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    // /v1 checks the API key before routing, so an unknown path without one is a JSON 401, never the app.
    const v1 = await request(app()).get('/v1/nope');
    expect(v1.status).toBe(401);
    expect(v1.headers['content-type']).toContain('application/json');
    expect((await request(app()).get('/api/health')).body.status).toBe('ok');
  });

  it('is off unless configured', async () => {
    const res = await request(createApp(testDeps(prisma, redis))).get('/flags');
    expect(res.status).toBe(404);
  });
});
