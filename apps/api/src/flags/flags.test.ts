import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { PrismaClient } from '../db.js';
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
import { eventsChannel, type FlagEvent, snapshotKey } from './events.js';

let prisma: PrismaClient;
let redis: Redis;
let subscriber: Redis;
let app: Express;
let mail: ReturnType<typeof captureMailer>;

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
  subscriber = connectTestRedis();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  await resetRedis(redis);
  mail = captureMailer();
  app = createApp(testDeps(prisma, redis, {}, mail.mailer));
});
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
  await subscriber.quit();
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

async function setup() {
  const admin = await register(app);
  const api = {
    create: (body: object) => request(app).post('/api/flags').set(bearer(admin.accessToken)).send(body),
    get: (id: string) => request(app).get(`/api/flags/${id}`).set(bearer(admin.accessToken)),
    list: (query: object = {}) => request(app).get('/api/flags').set(bearer(admin.accessToken)).query(query),
    patch: (id: string, body: object) =>
      request(app).patch(`/api/flags/${id}`).set(bearer(admin.accessToken)).send(body),
    toggle: (id: string) => request(app).post(`/api/flags/${id}/toggle`).set(bearer(admin.accessToken)),
    targets: (id: string, body: object) =>
      request(app).post(`/api/flags/${id}/targets`).set(bearer(admin.accessToken)).send(body),
    remove: (id: string) => request(app).delete(`/api/flags/${id}`).set(bearer(admin.accessToken)),
    endUser: (u: string) => request(app).get(`/api/end-users/${u}/flags`).set(bearer(admin.accessToken)),
    audit: (query: object = {}) =>
      request(app).get('/api/audit-logs').set(bearer(admin.accessToken)).query(query),
  };
  return { admin, api };
}

/** Collects events published on an org's channel while `fn` runs. */
async function eventsDuring(orgId: string, fn: () => Promise<unknown>): Promise<FlagEvent[]> {
  const events: FlagEvent[] = [];
  const onMessage = (_channel: string, message: string) => events.push(JSON.parse(message) as FlagEvent);
  await subscriber.subscribe(eventsChannel(orgId));
  subscriber.on('message', onMessage);
  try {
    await fn();
    await new Promise((r) => setTimeout(r, 100));
  } finally {
    subscriber.off('message', onMessage);
    await subscriber.unsubscribe(eventsChannel(orgId));
  }
  return events;
}

describe('flag CRUD', { timeout: 30_000 }, () => {
  it('creates a flag that starts off, with deduplicated targets', async () => {
    const { api } = await setup();
    const res = await api.create({
      key: 'dark_mode',
      description: 'Dark theme',
      targets: ['U001', 'U002', 'U001'],
    });
    expect(res.status).toBe(201);
    expect(res.body.flag).toMatchObject({
      key: 'dark_mode',
      enabled: false,
      targetAll: false,
      state: 'inactive',
      targets: ['U001', 'U002'],
      targetCount: 2,
    });
  });

  it('ignores enabled, orgId, version and id in the create body', async () => {
    const { api, admin } = await setup();
    const res = await api.create({
      key: 'sneaky',
      enabled: true,
      orgId: '00000000-0000-4000-8000-000000000000',
      version: 99,
    });
    expect(res.body.flag).toMatchObject({ enabled: false, version: 1 });
    expect((await prisma.flag.findFirstOrThrow({ where: { key: 'sneaky' } })).orgId).toBe(admin.orgId);
  });

  it('validates keys and target ids', async () => {
    const { api } = await setup();
    for (const key of ['Dark', 'a', 'has space', 'x'.repeat(65), 'dash-key']) {
      expect((await api.create({ key })).status).toBe(400);
    }
    expect((await api.create({ key: 'ok_key', targets: ['bad id'] })).status).toBe(400);
    expect(
      (await api.create({ key: 'ok_key', targets: Array.from({ length: 1001 }, (_, i) => `U${i}`) })).status,
    ).toBe(400);
  });

  it('rejects a duplicate key in the same org, allows it in another org', async () => {
    const { api } = await setup();
    await api.create({ key: 'dup' }).expect(201);
    const again = await api.create({ key: 'dup' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('FLAG_KEY_TAKEN');
    const other = await register(app);
    await request(app).post('/api/flags').set(bearer(other.accessToken)).send({ key: 'dup' }).expect(201);
  });

  it('toggles, edits and moves between board states', async () => {
    const { api } = await setup();
    const { id } = (await api.create({ key: 'beta' })).body.flag;
    expect((await api.toggle(id)).body.flag.state).toBe('testing');
    expect((await api.patch(id, { targetAll: true })).body.flag.state).toBe('live');
    expect((await api.toggle(id)).body.flag.state).toBe('inactive');
    expect((await api.patch(id, { description: 'Beta banner' })).body.flag.description).toBe('Beta banner');
    expect((await api.patch(id, {})).status).toBe(400);
  });

  it('adds and removes targets; a no-op change writes nothing', async () => {
    const { api } = await setup();
    const { id } = (await api.create({ key: 'checkout', targets: ['U001'] })).body.flag;
    const res = await api.targets(id, { add: ['U002', 'U003'], remove: ['U001'] });
    expect(res.body.flag.targets).toEqual(['U002', 'U003']);

    const before = await prisma.auditLog.count();
    const noop = await api.targets(id, { add: ['U002'], remove: ['U999'] });
    expect(noop.body.flag.targets).toEqual(['U002', 'U003']);
    expect(await prisma.auditLog.count()).toBe(before);

    expect((await api.targets(id, { add: ['U1'], remove: ['U1'] })).status).toBe(400);
    expect((await api.targets(id, {})).status).toBe(400);
  });

  it('two concurrent toggles both apply (the row lock serializes them)', async () => {
    const { api } = await setup();
    const { id } = (await api.create({ key: 'racy' })).body.flag;
    await Promise.all([api.toggle(id), api.toggle(id)]);
    expect((await api.get(id)).body.flag.enabled).toBe(false);
    expect(await prisma.auditLog.count({ where: { flagId: id, action: 'FLAG_TOGGLED' } })).toBe(2);
  });

  it('only admins can delete', async () => {
    const { api, admin } = await setup();
    const { id } = (await api.create({ key: 'doomed' })).body.flag;
    await request(app)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: 'm@example.test' });
    const member = await request(app)
      .post(`/api/auth/invites/${mail.lastInviteToken('m@example.test')}/accept`)
      .send({ name: 'M', password: 'a-long-password-1' });
    const asMember = bearer(member.body.accessToken);
    expect((await request(app).post(`/api/flags/${id}/toggle`).set(asMember)).status).toBe(200);
    expect((await request(app).delete(`/api/flags/${id}`).set(asMember)).status).toBe(403);
    expect((await api.remove(id)).status).toBe(204);
    expect((await api.get(id)).status).toBe(404);
  });

  it('404s for unknown and malformed ids on every flag route', async () => {
    const { api } = await setup();
    const missing = '00000000-0000-4000-8000-000000000000';
    for (const id of [missing, 'nope']) {
      expect((await api.get(id)).status).toBe(404);
      expect((await api.patch(id, { description: 'x' })).status).toBe(404);
      expect((await api.toggle(id)).status).toBe(404);
      expect((await api.targets(id, { add: ['U1'] })).status).toBe(404);
      expect((await api.remove(id)).status).toBe(404);
    }
  });
});

describe('listing and search', { timeout: 30_000 }, () => {
  it('filters by state and searches key and description', async () => {
    const { api } = await setup();
    const a = (await api.create({ key: 'dark_mode', description: 'Night theme' })).body.flag;
    const b = (await api.create({ key: 'chat_widget', targetAll: true })).body.flag;
    await api.create({ key: 'export_report' });
    await api.toggle(a.id);
    await api.toggle(b.id);

    const keys = async (q: object) => (await api.list(q)).body.flags.map((f: { key: string }) => f.key);
    expect(await keys({})).toEqual(['chat_widget', 'dark_mode', 'export_report']);
    expect(await keys({ state: 'inactive' })).toEqual(['export_report']);
    expect(await keys({ state: 'testing' })).toEqual(['dark_mode']);
    expect(await keys({ state: 'live' })).toEqual(['chat_widget']);
    expect(await keys({ search: 'DARK' })).toEqual(['dark_mode']);
    expect(await keys({ search: 'night' })).toEqual(['dark_mode']);
    expect((await api.list({ state: 'bogus' })).status).toBe(400);
  });

  it('treats LIKE wildcards in search as literal characters', async () => {
    const { api } = await setup();
    await api.create({ key: 'a_b' });
    await api.create({ key: 'axb' });
    const keys = async (search: string) =>
      (await api.list({ search })).body.flags.map((f: { key: string }) => f.key);
    expect(await keys('%')).toEqual([]);
    expect(await keys('_')).toEqual(['a_b']);
  });
});

describe('end-user lookup', { timeout: 30_000 }, () => {
  it('reports every flag with what that user gets', async () => {
    const { api } = await setup();
    const dark = (await api.create({ key: 'dark_mode', targets: ['U001'] })).body.flag;
    const chat = (await api.create({ key: 'chat_widget', targetAll: true })).body.flag;
    await api.create({ key: 'export_report', targets: ['U001'] });
    await api.toggle(dark.id);
    await api.toggle(chat.id);

    const res = await api.endUser('U001');
    expect(res.body.endUserId).toBe('U001');
    const byKey = Object.fromEntries(res.body.flags.map((f: { key: string }) => [f.key, f]));
    expect(byKey.dark_mode).toMatchObject({ enabled: true, targeted: true, flagEnabled: true });
    expect(byKey.chat_widget).toMatchObject({ enabled: true, targeted: false, targetAll: true });
    expect(byKey.export_report).toMatchObject({ enabled: false, targeted: true, flagEnabled: false });

    const other = await api.endUser('U002');
    expect(other.body.flags.find((f: { key: string }) => f.key === 'dark_mode')).toMatchObject({
      enabled: false,
    });
  });

  it('rejects malformed end-user ids', async () => {
    const { api } = await setup();
    expect((await api.endUser(encodeURIComponent('bad id'))).status).toBe(400);
  });
});

describe('audit log', { timeout: 30_000 }, () => {
  it('writes exactly one audit row per change, with before/after', async () => {
    const { api, admin } = await setup();
    const { id } = (await api.create({ key: 'audited' })).body.flag;
    await api.toggle(id);
    await api.patch(id, { description: 'now described' });
    await api.targets(id, { add: ['U1'] });
    await api.remove(id);

    const rows = await prisma.auditLog.findMany({ where: { flagId: id }, orderBy: { id: 'asc' } });
    expect(rows.map((r) => r.action)).toEqual([
      'FLAG_CREATED',
      'FLAG_TOGGLED',
      'FLAG_UPDATED',
      'FLAG_TARGETS_CHANGED',
      'FLAG_DELETED',
    ]);
    expect(rows.every((r) => r.actorId === admin.userId && r.orgId === admin.orgId)).toBe(true);
    expect(rows[1]!.metadata).toEqual({ before: { enabled: false }, after: { enabled: true } });
    expect(rows[2]!.metadata).toEqual({
      before: { description: '' },
      after: { description: 'now described' },
    });
    expect(rows[3]!.metadata).toEqual({ added: ['U1'], removed: [] });
  });

  it('pages newest first and filters by flag and actor (admin only)', async () => {
    const { api, admin } = await setup();
    const { id } = (await api.create({ key: 'paged' })).body.flag;
    for (let i = 0; i < 4; i++) await api.toggle(id);

    const first = await api.audit({ flagId: id, limit: 3 });
    expect(first.body.entries.map((e: { action: string }) => e.action)).toEqual([
      'FLAG_TOGGLED',
      'FLAG_TOGGLED',
      'FLAG_TOGGLED',
    ]);
    expect(first.body.entries[0].actor).toMatchObject({ id: admin.userId });
    const second = await api.audit({ flagId: id, limit: 3, cursor: first.body.nextCursor });
    expect(second.body.entries.map((e: { action: string }) => e.action)).toEqual([
      'FLAG_TOGGLED',
      'FLAG_CREATED',
    ]);
    expect(second.body.nextCursor).toBeNull();

    const byActor = await api.audit({ actorId: admin.userId });
    expect(byActor.body.entries.length).toBeGreaterThanOrEqual(7);
    expect((await api.audit({ cursor: 'abc' })).status).toBe(400);
  });
});

describe('snapshot invalidation and events', { timeout: 30_000 }, () => {
  it('every change deletes the cached snapshot and publishes one versioned event', async () => {
    const { api, admin } = await setup();
    const events = await eventsDuring(admin.orgId, async () => {
      const { id } = (await api.create({ key: 'live_flag', targets: ['U1'] })).body.flag;
      await redis.set(snapshotKey(admin.orgId), 'stale');
      await api.toggle(id);
      expect(await redis.exists(snapshotKey(admin.orgId))).toBe(0);
      await api.targets(id, { add: ['U2'] });
      await api.remove(id);
    });

    expect(events.map((e) => e.type)).toEqual([
      'flag.updated',
      'flag.updated',
      'flag.updated',
      'flag.deleted',
    ]);
    const versions = events.map((e) => e.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(events[1]).toMatchObject({ flag: { key: 'live_flag', enabled: true, targets: ['U1'] } });
    expect(events[3]).toMatchObject({ type: 'flag.deleted', key: 'live_flag' });

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: admin.orgId } });
    expect(org.flagsVersion).toBe(versions.at(-1));
  });

  it("an org's events never go to another org's channel", async () => {
    const a = await register(app);
    const b = await register(app);
    const events = await eventsDuring(b.orgId, async () => {
      await request(app).post('/api/flags').set(bearer(a.accessToken)).send({ key: 'private' }).expect(201);
    });
    expect(events).toEqual([]);
  });
});
