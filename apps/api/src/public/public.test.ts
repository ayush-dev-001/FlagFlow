import { createFlagClient, FlagClientAuthError, type Snapshot } from '@flagflow/flag-client';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeApp, createApp } from '../app.js';
import type { PrismaClient } from '../db.js';
import { snapshotKey } from '../flags/events.js';
import type { Redis } from '../redis.js';
import { register } from '../test/auth.js';
import {
  captureMailer,
  connectTestDb,
  connectTestRedis,
  resetDatabase,
  resetRedis,
  testDeps,
} from '../test/helpers.js';
import { listen, openStream, type TestStream } from '../test/server.js';

let prisma: PrismaClient;
let redis: Redis;
let app: Express;
let server: Awaited<ReturnType<typeof listen>>;
let mail: ReturnType<typeof captureMailer>;
const streams: TestStream[] = [];

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  await resetRedis(redis);
  mail = captureMailer();
  app = createApp({
    ...testDeps(prisma, redis, {}, mail.mailer),
    streamOptions: { heartbeatMs: 200, maxStreamsPerKey: 3 },
  });
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

/** An org with an admin, its API key, and dark_mode on for U001 only. */
async function orgWithFlag() {
  const admin = await register(app);
  const apiKey = admin.res.body.apiKey.key as string;
  const flag = (
    await request(app)
      .post('/api/flags')
      .set(bearer(admin.accessToken))
      .send({ key: 'dark_mode', targets: ['U001'] })
  ).body.flag as { id: string };
  await request(app).post(`/api/flags/${flag.id}/toggle`).set(bearer(admin.accessToken)).expect(200);
  const v1 = (path: string, key = apiKey) => request(app).get(`/v1${path}`).set('x-api-key', key);
  const toggle = () =>
    request(app).post(`/api/flags/${flag.id}/toggle`).set(bearer(admin.accessToken)).expect(200);
  const stream = async (key = apiKey, lastEventId?: number) => {
    const s = await openStream(server.baseUrl, key, lastEventId);
    streams.push(s);
    return s;
  };
  return { admin, apiKey, flagId: flag.id, v1, toggle, stream };
}

describe('API keys and org settings', { timeout: 30_000 }, () => {
  it('creates keys shown once, lists them without secrets, and caps active keys', async () => {
    const { admin } = await orgWithFlag();
    const t = bearer(admin.accessToken);
    const created = await request(app).post('/api/org/api-keys').set(t).send({ name: 'Rotation' });
    expect(created.status).toBe(201);
    expect(created.body.apiKey.key).toMatch(/^ff_live_/);

    const list = await request(app).get('/api/org/api-keys').set(t);
    expect(list.body.apiKeys.map((k: { name: string }) => k.name)).toEqual(['Rotation', 'Default']);
    expect(JSON.stringify(list.body)).not.toContain(created.body.apiKey.key);

    for (let i = 0; i < 8; i++)
      await request(app)
        .post('/api/org/api-keys')
        .set(t)
        .send({ name: `k${i}` })
        .expect(201);
    expect((await request(app).post('/api/org/api-keys').set(t).send({ name: 'eleventh' })).status).toBe(409);
  });

  it('a revoked key is rejected on the very next request, even though it was cached', async () => {
    const { admin, apiKey, v1 } = await orgWithFlag();
    expect((await v1('/snapshot')).status).toBe(200);
    const keyId = (await request(app).get('/api/org/api-keys').set(bearer(admin.accessToken))).body.apiKeys[0]
      .id;
    await request(app).delete(`/api/org/api-keys/${keyId}`).set(bearer(admin.accessToken)).expect(204);
    const res = await v1('/snapshot', apiKey);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
    expect(await prisma.auditLog.count({ where: { action: 'API_KEY_REVOKED' } })).toBe(1);
  });

  it('records lastUsedAt', async () => {
    const { v1 } = await orgWithFlag();
    await v1('/snapshot');
    await new Promise((r) => setTimeout(r, 100));
    expect((await prisma.apiKey.findFirstOrThrow()).lastUsedAt).not.toBeNull();
  });

  it('renames the org with an audit row; members cannot', async () => {
    const { admin } = await orgWithFlag();
    const res = await request(app)
      .patch('/api/org')
      .set(bearer(admin.accessToken))
      .send({ name: 'Renamed Inc' });
    expect(res.body.organization.name).toBe('Renamed Inc');
    expect(await prisma.auditLog.count({ where: { action: 'ORG_UPDATED' } })).toBe(1);

    await request(app)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: 'm@example.test' });
    const member = await request(app)
      .post(`/api/auth/invites/${mail.lastInviteToken('m@example.test')}/accept`)
      .send({ name: 'M', password: 'a-long-password-1' });
    expect((await request(app).get('/api/org/api-keys').set(bearer(member.body.accessToken))).status).toBe(
      403,
    );
  });
});

describe('evaluate and snapshot', { timeout: 30_000 }, () => {
  it('evaluates all flags and one flag for a user', async () => {
    const { v1 } = await orgWithFlag();
    expect((await v1('/flags/evaluate?userId=U001')).body.flags).toEqual({ dark_mode: true });
    expect((await v1('/flags/evaluate?userId=U002')).body.flags).toEqual({ dark_mode: false });
    expect((await v1('/flags/dark_mode/evaluate?userId=U001')).body.enabled).toBe(true);
  });

  it('an unknown flag is off, not an error', async () => {
    const { v1 } = await orgWithFlag();
    const res = await v1('/flags/not_built_yet/evaluate?userId=U001');
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('validates userId and flag keys', async () => {
    const { v1 } = await orgWithFlag();
    expect((await v1('/flags/evaluate')).status).toBe(400);
    expect((await v1('/flags/evaluate?userId=bad%20id')).status).toBe(400);
    expect((await v1('/flags/Bad-Key/evaluate?userId=U001')).status).toBe(400);
  });

  it('requires a valid API key', async () => {
    const { v1 } = await orgWithFlag();
    expect((await request(app).get('/v1/snapshot')).status).toBe(401);
    expect((await v1('/snapshot', `ff_live_${'A'.repeat(32)}`)).status).toBe(401);
    expect((await v1('/snapshot', 'not-a-key')).status).toBe(401);
  });

  it('caches the snapshot and serves a new version after a change', async () => {
    const { admin, v1, toggle } = await orgWithFlag();
    const first = (await v1('/snapshot')).body as Snapshot;
    expect(await redis.exists(snapshotKey(admin.orgId))).toBe(1);
    await toggle();
    expect(await redis.exists(snapshotKey(admin.orgId))).toBe(0);
    const second = (await v1('/snapshot')).body as Snapshot;
    expect(second.version).toBe(first.version + 1);
    expect(second.flags[0]).toMatchObject({ key: 'dark_mode', enabled: false });
  });

  it('a disabled org’s key stops working', async () => {
    const { admin, apiKey, v1 } = await orgWithFlag();
    await prisma.organization.update({ where: { id: admin.orgId }, data: { isActive: false } });
    await redis.flushdb();
    expect((await v1('/snapshot', apiKey)).status).toBe(401);
  });
});

describe('GET /v1/stream', { timeout: 30_000 }, () => {
  it('sends the snapshot first, then a toggle arrives in under 1 second', async () => {
    const { stream, toggle } = await orgWithFlag();
    const s = await stream();
    expect(s.status).toBe(200);
    const snap = JSON.parse((await s.next('snapshot')).data) as Snapshot;
    expect(snap.flags).toHaveLength(1);

    const sentAt = performance.now();
    await toggle();
    const event = await s.next('flag.updated');
    expect(event.receivedAt - sentAt).toBeLessThan(1000);
    expect(Number(event.id)).toBe(snap.version + 1);
    expect(JSON.parse(event.data)).toMatchObject({ flag: { key: 'dark_mode', enabled: false } });
  });

  it('resumes without a snapshot when Last-Event-ID is current, resends it when stale', async () => {
    const { stream, toggle, v1 } = await orgWithFlag();
    const version = ((await v1('/snapshot')).body as Snapshot).version;

    const current = await stream(undefined, version);
    await toggle();
    expect((await current.next('flag.updated')).id).toBe(String(version + 1));
    expect(current.messages.some((m) => m.event === 'snapshot')).toBe(false);

    const stale = await stream(undefined, version - 1);
    expect(Number((await stale.next('snapshot')).id)).toBe(version + 1);
  });

  it('sends heartbeats', async () => {
    const { apiKey } = await orgWithFlag();
    const res = await fetch(`${server.baseUrl}/v1/stream`, { headers: { 'x-api-key': apiKey } });
    const reader = res.body!.getReader();
    let text = '';
    const deadline = Date.now() + 2000;
    while (!text.includes(': ping') && Date.now() < deadline) {
      text += new TextDecoder().decode((await reader.read()).value);
    }
    await reader.cancel();
    expect(text).toContain(': ping');
  });

  it('caps open streams per key', async () => {
    const { stream } = await orgWithFlag();
    for (let i = 0; i < 3; i++) expect((await stream()).status).toBe(200);
    expect((await stream()).status).toBe(429);
  });

  it('counts connected clients per org for the dashboard', async () => {
    const { admin, stream } = await orgWithFlag();
    const other = await orgWithFlag();
    const count = async (token = admin.accessToken) =>
      (await request(app).get('/api/flags/connections').set(bearer(token)).expect(200)).body
        .connectedClients as number;
    expect(await count()).toBe(0);
    const open = await Promise.all([stream(), stream()]);
    await other.stream();
    expect(await count()).toBe(2);
    expect(await count(other.admin.accessToken)).toBe(1);
    open[0].close();
    await new Promise((r) => setTimeout(r, 200));
    expect(await count()).toBe(1);
  });

  it('frees a slot when a stream closes', async () => {
    const { stream } = await orgWithFlag();
    const open = await Promise.all([stream(), stream(), stream()]);
    open[0].close();
    await new Promise((r) => setTimeout(r, 200));
    expect((await stream()).status).toBe(200);
  });

  it('revoking the key ends its open streams', async () => {
    const { admin, stream } = await orgWithFlag();
    const s = await stream();
    await s.next('snapshot');
    const keyId = (await request(app).get('/api/org/api-keys').set(bearer(admin.accessToken))).body.apiKeys[0]
      .id;
    await request(app).delete(`/api/org/api-keys/${keyId}`).set(bearer(admin.accessToken)).expect(204);
    const err = await s.next('error');
    expect(JSON.parse(err.data)).toMatchObject({ code: 'API_KEY_REVOKED' });
    await s.ended;
  });

  it("org B's stream never receives org A's events", async () => {
    const a = await orgWithFlag();
    const b = await orgWithFlag();
    const sb = await b.stream();
    await sb.next('snapshot');
    await a.toggle();
    await a.toggle();
    await new Promise((r) => setTimeout(r, 300));
    expect(sb.messages.filter((m) => m.event !== 'snapshot')).toEqual([]);
  });
});

describe('flag-client', { timeout: 30_000 }, () => {
  it('evaluates locally and follows live changes', async () => {
    const { apiKey, toggle, admin, flagId } = await orgWithFlag();
    const changes: number[] = [];
    const client = createFlagClient({
      baseUrl: server.baseUrl,
      apiKey,
      onChange: (s) => changes.push(s.version),
      minRetryMs: 50,
    });
    expect(client.isEnabled('dark_mode', 'U001')).toBe(false);
    await client.start();
    expect(client.isEnabled('dark_mode', 'U001')).toBe(true);
    expect(client.isEnabled('dark_mode', 'U002')).toBe(false);
    expect(client.isEnabled('missing', 'U001')).toBe(false);

    const waitFor = async (cond: () => boolean) => {
      const deadline = Date.now() + 2000;
      while (!cond() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
      return cond();
    };
    const sentAt = performance.now();
    await toggle();
    expect(await waitFor(() => !client.isEnabled('dark_mode', 'U001'))).toBe(true);
    expect(performance.now() - sentAt).toBeLessThan(1000);

    await request(app).delete(`/api/flags/${flagId}`).set(bearer(admin.accessToken)).expect(204);
    expect(await waitFor(() => !('dark_mode' in client.getAll('U001')))).toBe(true);
    client.close();
  });

  it('stops with an auth error when its key is revoked', async () => {
    const { apiKey, admin } = await orgWithFlag();
    const errors: Error[] = [];
    const client = createFlagClient({
      baseUrl: server.baseUrl,
      apiKey,
      onError: (e) => errors.push(e),
      minRetryMs: 50,
    });
    await client.start();
    await new Promise((r) => setTimeout(r, 200));
    const keyId = (await request(app).get('/api/org/api-keys').set(bearer(admin.accessToken))).body.apiKeys[0]
      .id;
    await request(app).delete(`/api/org/api-keys/${keyId}`).set(bearer(admin.accessToken)).expect(204);
    const deadline = Date.now() + 2000;
    while (errors.length === 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    expect(errors[0]).toBeInstanceOf(FlagClientAuthError);
    client.close();
  });

  it('start() rejects for a bad key', async () => {
    const client = createFlagClient({ baseUrl: server.baseUrl, apiKey: `ff_live_${'B'.repeat(32)}` });
    await expect(client.start()).rejects.toBeInstanceOf(FlagClientAuthError);
  });
});
