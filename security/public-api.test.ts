// Phase 5 attack tests: API-key guessing and revocation, credential confusion, SSE cross-tenant leakage,
// stream abuse and CORS on the public /v1 API.
import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeApp, createApp } from '../apps/api/src/app.js';
import type { PrismaClient } from '../apps/api/src/db.js';
import type { Redis } from '../apps/api/src/redis.js';
import { register } from '../apps/api/src/test/auth.js';
import {
  connectTestDb,
  connectTestRedis,
  resetDatabase,
  resetRedis,
  testDeps,
} from '../apps/api/src/test/helpers.js';
import { listen, openStream, type TestStream } from '../apps/api/src/test/server.js';

let prisma: PrismaClient;
let redis: Redis;
let app: Express;
let server: Awaited<ReturnType<typeof listen>>;
const streams: TestStream[] = [];

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  await resetRedis(redis);
  app = createApp({ ...testDeps(prisma, redis), streamOptions: { heartbeatMs: 200, maxStreamsPerKey: 2 } });
  server = await listen(app);
});
afterEach(async () => {
  for (const s of streams.splice(0)) s.close();
  await closeApp(app);
  await server.close();
});
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const fakeKey = () => `ff_live_${randomBytes(24).toString('base64url')}`;

async function org(flagKey = 'secret_feature') {
  const admin = await register(app);
  const apiKey = admin.res.body.apiKey.key as string;
  const flag = (
    await request(app)
      .post('/api/flags')
      .set(bearer(admin.accessToken))
      .send({ key: flagKey, targetAll: true })
  ).body.flag as { id: string };
  await request(app).post(`/api/flags/${flag.id}/toggle`).set(bearer(admin.accessToken)).expect(200);
  const stream = async (key = apiKey, lastEventId?: number) => {
    const s = await openStream(server.baseUrl, key, lastEventId);
    streams.push(s);
    return s;
  };
  return { admin, apiKey, flagId: flag.id, stream };
}

describe('API key guessing', { timeout: 30_000 }, () => {
  it('random well-formed keys, truncated, padded and case-flipped real keys all get 401', async () => {
    const { apiKey } = await org();
    const flipped =
      apiKey.slice(0, 8) +
      [...apiKey.slice(8)].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
    for (const key of [
      fakeKey(),
      apiKey.slice(0, -1),
      `${apiKey}A`,
      flipped,
      apiKey.replace('ff_live_', 'ff_test_'),
      `${apiKey} x`,
      // (A leading/trailing space is not a forgery: HTTP strips header whitespace, so it *is* the real key.)
    ]) {
      const res = await request(app).get('/v1/snapshot').set('x-api-key', key);
      expect(res.status).toBe(401);
    }
  });

  it('is rate limited per IP after 30 failures, and spoofed X-Forwarded-For does not reset it', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) {
      const res = await request(app)
        .get('/v1/snapshot')
        .set({ 'x-api-key': fakeKey(), 'x-forwarded-for': `10.0.0.${i}` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(30)).toEqual([429, 429]);
  });

  it('valid traffic is not counted toward the failure limit', async () => {
    const { apiKey } = await org();
    for (let i = 0; i < 40; i++)
      expect((await request(app).get('/v1/snapshot').set('x-api-key', apiKey)).status).toBe(200);
  });

  it('only the key hash is stored', async () => {
    const { apiKey } = await org();
    const rows = await prisma.apiKey.findMany();
    expect(JSON.stringify(rows)).not.toContain(apiKey);
    expect(await redis.keys('*')).not.toContain(apiKey);
  });
});

describe('revoked keys', { timeout: 30_000 }, () => {
  it('a revoked key fails on every /v1 route, including the stream', async () => {
    const { admin, apiKey, stream } = await org();
    await request(app).get('/v1/snapshot').set('x-api-key', apiKey).expect(200);
    const keyId = (await request(app).get('/api/org/api-keys').set(bearer(admin.accessToken))).body.apiKeys[0]
      .id;
    await request(app).delete(`/api/org/api-keys/${keyId}`).set(bearer(admin.accessToken)).expect(204);
    for (const path of [
      '/v1/snapshot',
      '/v1/flags/evaluate?userId=U1',
      '/v1/flags/secret_feature/evaluate?userId=U1',
    ]) {
      expect((await request(app).get(path).set('x-api-key', apiKey)).status).toBe(401);
    }
    expect((await stream()).status).toBe(401);
  });

  it("org B's admin cannot revoke org A's key", async () => {
    const a = await org();
    const b = await org();
    const aKeyId = (await request(app).get('/api/org/api-keys').set(bearer(a.admin.accessToken))).body
      .apiKeys[0].id;
    expect(
      (await request(app).delete(`/api/org/api-keys/${aKeyId}`).set(bearer(b.admin.accessToken))).status,
    ).toBe(404);
    expect((await request(app).get('/v1/snapshot').set('x-api-key', a.apiKey)).status).toBe(200);
  });
});

describe('credential confusion', { timeout: 30_000 }, () => {
  it('an API key cannot be used on dashboard routes, and a JWT cannot be used on /v1', async () => {
    const { admin, apiKey } = await org();
    expect((await request(app).get('/api/flags').set('x-api-key', apiKey)).status).toBe(401);
    expect((await request(app).get('/api/flags').set(bearer(apiKey))).status).toBe(401);
    expect((await request(app).get('/v1/snapshot').set(bearer(admin.accessToken))).status).toBe(401);
    expect((await request(app).get('/v1/snapshot').set('x-api-key', admin.accessToken)).status).toBe(401);
  });

  it('a key only ever sees its own org, whatever ids are sent', async () => {
    const a = await org('a_only');
    const b = await org('b_only');
    const res = await request(app)
      .get('/v1/snapshot')
      .set({ 'x-api-key': b.apiKey, 'x-org-id': a.admin.orgId })
      .query({ orgId: a.admin.orgId });
    expect(res.body.flags.map((f: { key: string }) => f.key)).toEqual(['b_only']);
    const evalRes = await request(app)
      .get('/v1/flags/a_only/evaluate')
      .set('x-api-key', b.apiKey)
      .query({ userId: 'U1' });
    expect(evalRes.body.enabled).toBe(false);
  });
});

describe('SSE cross-tenant leakage and stream abuse', { timeout: 30_000 }, () => {
  it("org B's stream never sees org A's snapshot or events", async () => {
    const a = await org('a_secret');
    const b = await org('b_flag');
    const sb = await b.stream();
    const snap = JSON.parse((await sb.next('snapshot')).data) as { flags: { key: string }[] };
    expect(snap.flags.map((f) => f.key)).toEqual(['b_flag']);
    for (let i = 0; i < 3; i++) {
      await request(app).post(`/api/flags/${a.flagId}/toggle`).set(bearer(a.admin.accessToken)).expect(200);
    }
    await new Promise((r) => setTimeout(r, 300));
    expect(JSON.stringify(sb.messages)).not.toContain('a_secret');
  });

  it('crafted Last-Event-ID values just get a fresh snapshot', async () => {
    const { stream } = await org();
    for (const id of [-1, 999_999_999, Number.MAX_SAFE_INTEGER]) {
      const s = await stream(undefined, id);
      expect(s.status).toBe(200);
      await s.next('snapshot');
      s.close();
    }
    const res = await fetch(`${server.baseUrl}/v1/stream`, {
      headers: { 'x-api-key': (await org('other')).apiKey, 'last-event-id': "1' OR 1=1" },
    });
    expect(res.status).toBe(200);
    await res.body?.cancel();
  });

  it("one key exhausting its streams doesn't block another org", async () => {
    const a = await org();
    const b = await org();
    await a.stream();
    await a.stream();
    expect((await a.stream()).status).toBe(429);
    expect((await b.stream()).status).toBe(200);
  });
});

describe('injection and CORS on /v1', { timeout: 30_000 }, () => {
  it('SQL and odd values in userId and flag key are rejected or inert', async () => {
    const { apiKey } = await org();
    for (const userId of ["' OR 1=1 --", 'U1; DROP TABLE flag', '<script>', 'x'.repeat(200)]) {
      expect(
        (await request(app).get('/v1/flags/evaluate').set('x-api-key', apiKey).query({ userId })).status,
      ).toBe(400);
    }
    for (const key of ["secret_feature' OR '1'='1", '..%2F..%2Fsnapshot', 'SECRET_FEATURE']) {
      const res = await request(app)
        .get(`/v1/flags/${encodeURIComponent(key)}/evaluate`)
        .set('x-api-key', apiKey)
        .query({ userId: 'U1' });
      expect([400, 404]).toContain(res.status);
    }
    expect(
      (
        await request(app)
          .get('/v1/flags/evaluate')
          .set('x-api-key', apiKey)
          .query({ userId: ['a', 'b'] })
      ).status,
    ).toBe(400);
  });

  it('marks every /v1 response uncacheable, so a shared cache cannot replay one org’s answer to another', async () => {
    const { apiKey } = await org();
    for (const path of [
      '/v1/snapshot',
      '/v1/flags/evaluate?userId=U1',
      '/v1/flags/secret_feature/evaluate?userId=U1',
    ]) {
      const ok = await request(app).get(path).set('x-api-key', apiKey);
      expect(ok.headers['cache-control']).toBe('no-store');
      expect(ok.headers.vary).toMatch(/x-api-key/i);
    }
    const rejected = await request(app).get('/v1/snapshot').set('x-api-key', fakeKey());
    expect(rejected.headers['cache-control']).toBe('no-store');
  });

  it('sends no CORS headers to any origin, including the dashboard', async () => {
    const { apiKey } = await org();
    for (const origin of ['http://localhost:5173', 'https://evil.example', 'null']) {
      const res = await request(app).get('/v1/snapshot').set({ 'x-api-key': apiKey, origin });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      const pre = await request(app).options('/v1/snapshot').set({
        origin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'x-api-key',
      });
      expect(pre.headers['access-control-allow-origin']).toBeUndefined();
    }
  });
});
