// Phase 4 attack tests: org isolation on every flag route, role checks, mass assignment and injection.
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import type { PrismaClient } from '../apps/api/src/db.js';
import { eventsChannel } from '../apps/api/src/flags/events.js';
import type { Redis } from '../apps/api/src/redis.js';
import { register } from '../apps/api/src/test/auth.js';
import {
  captureMailer,
  connectTestDb,
  connectTestRedis,
  resetDatabase,
  resetRedis,
  testDeps,
} from '../apps/api/src/test/helpers.js';

let prisma: PrismaClient;
let redis: Redis;
let app: Express;
let mail: ReturnType<typeof captureMailer>;

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
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
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

/** Org A with a targeted, enabled flag and audit history; org B empty. */
async function twoOrgs() {
  const a = await register(app);
  const b = await register(app);
  const flag = (
    await request(app)
      .post('/api/flags')
      .set(bearer(a.accessToken))
      .send({ key: 'secret_feature', description: 'A only', targets: ['U001'] })
  ).body.flag as { id: string };
  await request(app).post(`/api/flags/${flag.id}/toggle`).set(bearer(a.accessToken)).expect(200);
  return { a, b, flagId: flag.id };
}

describe('org isolation on every flag route', { timeout: 60_000 }, () => {
  it("org B can't see, change, toggle, retarget or delete org A's flag", async () => {
    const { a, b, flagId } = await twoOrgs();
    const t = bearer(b.accessToken);
    const before = await prisma.flag.findUniqueOrThrow({ where: { id: flagId }, include: { targets: true } });

    expect((await request(app).get(`/api/flags/${flagId}`).set(t)).status).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/flags/${flagId}`)
          .set(t)
          .send({ description: 'pwned', targetAll: true })
      ).status,
    ).toBe(404);
    expect((await request(app).post(`/api/flags/${flagId}/toggle`).set(t)).status).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/flags/${flagId}/targets`)
          .set(t)
          .send({ add: ['ATTACKER'], remove: ['U001'] })
      ).status,
    ).toBe(404);
    expect((await request(app).delete(`/api/flags/${flagId}`).set(t)).status).toBe(404);

    const after = await prisma.flag.findUniqueOrThrow({ where: { id: flagId }, include: { targets: true } });
    expect(after).toEqual(before);
    expect(await prisma.auditLog.count({ where: { orgId: b.orgId, flagId } })).toBe(0);
    expect(a.orgId).not.toBe(b.orgId);
  });

  it("org B's list, search and end-user lookup never include org A's flags", async () => {
    const { b } = await twoOrgs();
    const t = bearer(b.accessToken);
    expect((await request(app).get('/api/flags').set(t)).body.flags).toEqual([]);
    expect((await request(app).get('/api/flags').set(t).query({ search: 'secret' })).body.flags).toEqual([]);
    for (const state of ['inactive', 'testing', 'live']) {
      expect((await request(app).get('/api/flags').set(t).query({ state })).body.flags).toEqual([]);
    }
    expect((await request(app).get('/api/end-users/U001/flags').set(t)).body.flags).toEqual([]);
  });

  it("org B's audit log never shows org A's entries, even when filtering by A's flag or actor", async () => {
    const { a, b, flagId } = await twoOrgs();
    const t = bearer(b.accessToken);
    for (const query of [{ flagId }, { actorId: a.userId }, {}]) {
      const entries = (await request(app).get('/api/audit-logs').set(t).query(query)).body.entries as {
        action: string;
      }[];
      expect(entries.every((e) => ['ORG_CREATED', 'API_KEY_CREATED'].includes(e.action))).toBe(true);
      expect(JSON.stringify(entries)).not.toContain(flagId);
    }
  });

  it("paging with org A's cursors (or a huge one) still shows org B only its own entries", async () => {
    const { a, b } = await twoOrgs();
    const aPage = await request(app).get('/api/audit-logs').set(bearer(a.accessToken)).query({ limit: 1 });
    const aCursor = aPage.body.nextCursor as string;
    expect(aCursor).toBeTruthy();
    for (const cursor of [aCursor, aPage.body.entries[0].id as string, '999999999999']) {
      const res = await request(app).get('/api/audit-logs').set(bearer(b.accessToken)).query({ cursor });
      expect(res.status).toBe(200);
      const actors = new Set(
        (res.body.entries as { actor: { id: string } | null }[]).map((e) => e.actor?.id),
      );
      expect(actors.has(a.userId)).toBe(false);
      expect([...actors].every((id) => id === b.userId)).toBe(true);
    }
  });

  it('org ids smuggled in body, query or headers are ignored', async () => {
    const { a, b } = await twoOrgs();
    const res = await request(app)
      .post('/api/flags')
      .set({ ...bearer(b.accessToken), 'x-org-id': a.orgId })
      .query({ orgId: a.orgId })
      .send({ key: 'planted', orgId: a.orgId });
    expect(res.status).toBe(201);
    expect((await prisma.flag.findUniqueOrThrow({ where: { id: res.body.flag.id } })).orgId).toBe(b.orgId);
  });

  it("org A's changes are published only on org A's channel", async () => {
    const { a, b, flagId } = await twoOrgs();
    const sub = connectTestRedis();
    const seen: string[] = [];
    sub.on('message', (channel: string) => seen.push(channel));
    await sub.subscribe(eventsChannel(b.orgId));
    await request(app).post(`/api/flags/${flagId}/toggle`).set(bearer(a.accessToken)).expect(200);
    await new Promise((r) => setTimeout(r, 100));
    await sub.quit();
    expect(seen).toEqual([]);
  });
});

describe('roles and mass assignment', { timeout: 60_000 }, () => {
  async function memberOf(adminToken: string) {
    const email = `m-${Date.now()}@example.test`;
    await request(app).post('/api/team/invites').set(bearer(adminToken)).send({ email }).expect(201);
    const res = await request(app)
      .post(`/api/auth/invites/${mail.lastInviteToken(email)}/accept`)
      .send({ name: 'Member', password: 'a-long-password-1' });
    return res.body.accessToken as string;
  }

  it('a member cannot delete flags or read the audit log', async () => {
    const { a, flagId } = await twoOrgs();
    const t = bearer(await memberOf(a.accessToken));
    expect((await request(app).delete(`/api/flags/${flagId}`).set(t)).status).toBe(403);
    expect((await request(app).get('/api/audit-logs').set(t)).status).toBe(403);
  });

  it('PATCH cannot set enabled, key, orgId, version or authorship', async () => {
    const { a, b, flagId } = await twoOrgs();
    const before = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    await request(app)
      .patch(`/api/flags/${flagId}`)
      .set(bearer(a.accessToken))
      .send({
        description: 'ok',
        enabled: !before.enabled,
        key: 'renamed',
        orgId: b.orgId,
        version: 1,
        createdById: b.userId,
      })
      .expect(200);
    const after = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } });
    expect(after).toMatchObject({
      enabled: before.enabled,
      key: before.key,
      orgId: before.orgId,
      createdById: before.createdById,
    });
    expect(after.version).toBeGreaterThan(before.version);
  });

  it('target rows cannot be pointed at another org', async () => {
    const { a, b, flagId } = await twoOrgs();
    await request(app)
      .post(`/api/flags/${flagId}/targets`)
      .set(bearer(a.accessToken))
      .send({ add: ['U002'], orgId: b.orgId })
      .expect(200);
    expect(await prisma.flagTarget.count({ where: { orgId: b.orgId } })).toBe(0);
  });
});

describe('injection and abuse', { timeout: 60_000 }, () => {
  it('SQL in search, ids and end-user ids is inert', async () => {
    const { a, flagId } = await twoOrgs();
    const t = bearer(a.accessToken);
    for (const search of ["' OR 1=1 --", "%' OR '1'='1", '\\', "secret'; DROP TABLE flag; --"]) {
      const res = await request(app).get('/api/flags').set(t).query({ search });
      expect(res.status).toBe(200);
      expect(res.body.flags).toEqual([]);
    }
    expect(
      (
        await request(app)
          .get(`/api/flags/${encodeURIComponent("' OR 1=1 --")}`)
          .set(t)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/end-users/${encodeURIComponent("U001' OR '1'='1")}/flags`)
          .set(t)
      ).status,
    ).toBe(400);
    expect(await prisma.flag.count({ where: { id: flagId } })).toBe(1);
  });

  it('stored XSS in a description comes back as an inert JSON string', async () => {
    const { a } = await twoOrgs();
    const xss = '<img src=x onerror=alert(1)><script>fetch("//evil")</script>';
    const res = await request(app)
      .post('/api/flags')
      .set(bearer(a.accessToken))
      .send({ key: 'xss_test', description: xss });
    const got = await request(app).get(`/api/flags/${res.body.flag.id}`).set(bearer(a.accessToken));
    expect(got.headers['content-type']).toMatch(/^application\/json/);
    expect(got.body.flag.description).toBe(xss);
  });

  it('cannot grow a flag past the target limit by repeated adds', async () => {
    const { a, flagId } = await twoOrgs();
    await prisma.flagTarget.createMany({
      data: Array.from({ length: 9_999 }, (_, i) => ({ flagId, endUserId: `bulk${i}`, orgId: a.orgId })),
    });
    const res = await request(app)
      .post(`/api/flags/${flagId}/targets`)
      .set(bearer(a.accessToken))
      .send({ add: ['one_more', 'two_more'] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_TARGETS');
  });

  it('wrong types and oversized arrays are rejected', async () => {
    const { a, flagId } = await twoOrgs();
    const t = bearer(a.accessToken);
    expect(
      (
        await request(app)
          .post('/api/flags')
          .set(t)
          .send({ key: ['array'] })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).post('/api/flags').set(t).send({ key: 'ok_key', targetAll: 'yes' })).status,
    ).toBe(400);
    expect((await request(app).post(`/api/flags/${flagId}/targets`).set(t).send({ add: 'U1' })).status).toBe(
      400,
    );
    expect(
      (
        await request(app)
          .post(`/api/flags/${flagId}/targets`)
          .set(t)
          .send({ add: [{ $ne: null }] })
      ).status,
    ).toBe(400);
  });
});
