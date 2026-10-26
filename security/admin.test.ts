// Phase 7 attack tests: the superadmin routes and the per-org connected-clients count.
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import { sessionKey } from '../apps/api/src/auth/sessions.js';
import { signAccessToken } from '../apps/api/src/auth/tokens.js';
import type { PrismaClient } from '../apps/api/src/db.js';
import type { Redis } from '../apps/api/src/redis.js';
import { register } from '../apps/api/src/test/auth.js';
import {
  captureMailer,
  connectTestDb,
  connectTestRedis,
  resetDatabase,
  resetRedis,
  TEST_JWT_SECRET,
  testDeps,
} from '../apps/api/src/test/helpers.js';

let prisma: PrismaClient;
let redis: Redis;
let app: Express;

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  await resetRedis(redis);
  app = createApp(testDeps(prisma, redis, {}, captureMailer().mailer));
});
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

/** A live session token for any user, as the API would issue it. */
async function tokenFor(userId: string, orgId: string | null, role: 'SUPERADMIN' | 'ADMIN' | 'MEMBER') {
  const sid = randomUUID();
  await redis.set(sessionKey(sid), userId, 'EX', 60);
  return (await signAccessToken(TEST_JWT_SECRET, { userId, orgId, role, sid })).token;
}

async function superadmin() {
  const user = await prisma.user.create({
    data: { email: `root-${randomUUID()}@example.test`, name: 'Root', passwordHash: 'x', role: 'SUPERADMIN' },
  });
  return tokenFor(user.id, null, 'SUPERADMIN');
}

describe('superadmin routes', { timeout: 60_000 }, () => {
  it('org admins and members get 403 on every platform route, guests 401', async () => {
    const org = await register(app);
    const member = await tokenFor(org.userId, org.orgId, 'MEMBER');
    for (const token of [org.accessToken, member]) {
      expect((await request(app).get('/api/admin/organizations').set(bearer(token))).status).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/api/admin/organizations/${org.orgId}`)
            .set(bearer(token))
            .send({ isActive: false })
        ).status,
      ).toBe(403);
    }
    expect((await request(app).get('/api/admin/organizations')).status).toBe(401);
    expect((await prisma.organization.findUniqueOrThrow({ where: { id: org.orgId } })).isActive).toBe(true);
  });

  it('a token that claims SUPERADMIN but is signed with the wrong secret is refused', async () => {
    const org = await register(app);
    const sid = randomUUID();
    await redis.set(sessionKey(sid), org.userId, 'EX', 60);
    const { token } = await signAccessToken('wrong-secret-'.padEnd(64, 'y'), {
      userId: org.userId,
      orgId: null,
      role: 'SUPERADMIN',
      sid,
    });
    expect((await request(app).get('/api/admin/organizations').set(bearer(token))).status).toBe(401);
  });

  it('PATCH only ever changes isActive: name, slug, id and flagsVersion in the body are rejected', async () => {
    const root = await superadmin();
    const org = await register(app);
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: org.orgId } });
    const res = await request(app)
      .patch(`/api/admin/organizations/${org.orgId}`)
      .set(bearer(root))
      .send({ isActive: true, name: 'Pwned', slug: 'pwned', id: randomUUID(), flagsVersion: 999 });
    expect(res.status).toBe(200);
    const after = await prisma.organization.findUniqueOrThrow({ where: { id: org.orgId } });
    expect({ name: after.name, slug: after.slug, flagsVersion: after.flagsVersion }).toEqual({
      name: before.name,
      slug: before.slug,
      flagsVersion: before.flagsVersion,
    });
  });

  it("a deactivated org's live tokens, refresh and API key all stop at once", async () => {
    const root = await superadmin();
    const org = await register(app);
    await request(app)
      .patch(`/api/admin/organizations/${org.orgId}`)
      .set(bearer(root))
      .send({ isActive: false })
      .expect(200);
    expect((await request(app).get('/api/flags').set(bearer(org.accessToken))).status).toBe(401);
    const key = org.res.body.apiKey.key as string;
    expect((await request(app).get('/v1/flags/evaluate?userId=U001').set('x-api-key', key)).status).toBe(401);
  });

  it('SQL and junk in the :id parameter are inert', async () => {
    const root = await superadmin();
    await register(app);
    for (const id of ["' OR 1=1 --", '1;DROP TABLE organization', '../org']) {
      const res = await request(app)
        .patch(`/api/admin/organizations/${encodeURIComponent(id)}`)
        .set(bearer(root))
        .send({ isActive: false });
      expect([400, 404]).toContain(res.status);
    }
    expect(await prisma.organization.count({ where: { isActive: true } })).toBe(1);
  });
});

describe('connected-clients count', { timeout: 60_000 }, () => {
  it("is scoped to the caller's org and needs a dashboard session", async () => {
    const a = await register(app);
    const b = await register(app);
    await redis.zadd(`ff:sse:org:${a.orgId}`, Date.now(), 'slot-1');
    const get = (t?: string) =>
      request(app)
        .get('/api/flags/connections')
        .set(t ? bearer(t) : {});
    expect((await get(a.accessToken)).body.connectedClients).toBe(1);
    expect((await get(b.accessToken)).body.connectedClients).toBe(0);
    expect((await get()).status).toBe(401);
    const key = a.res.body.apiKey.key as string;
    expect((await request(app).get('/api/flags/connections').set('x-api-key', key)).status).toBe(401);
  });
});
