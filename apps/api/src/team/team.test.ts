import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { PrismaClient } from '../db.js';
import type { Redis } from '../redis.js';
import { refresh, register } from '../test/auth.js';
import {
  captureMailer,
  connectTestDb,
  connectTestRedis,
  resetDatabase,
  resetRedis,
  testDeps,
} from '../test/helpers.js';

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

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

/** An org with an admin and one invited member. */
async function orgWithMember(role: 'ADMIN' | 'MEMBER' = 'MEMBER') {
  const admin = await register(app);
  const email = `m${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.test`;
  await request(app)
    .post('/api/team/invites')
    .set(bearer(admin.accessToken))
    .send({ email, role })
    .expect(201);
  const joined = await request(app)
    .post(`/api/auth/invites/${mail.lastInviteToken(email)}/accept`)
    .send({ name: 'Member', password: 'a-long-password-1' })
    .expect(201);
  return {
    admin,
    member: { id: joined.body.user.id as string, token: joined.body.accessToken as string, email },
    memberCookie: (joined.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!,
  };
}

const patch = (token: string, id: string, body: object) =>
  request(app).patch(`/api/team/members/${id}`).set(bearer(token)).send(body);

describe('GET /api/team/members', { timeout: 30_000 }, () => {
  it('lists the org members for any role, without password hashes', async () => {
    const { admin, member } = await orgWithMember();
    const res = await request(app).get('/api/team/members').set(bearer(member.token));
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { id: string }) => m.id)).toEqual([admin.userId, member.id]);
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

describe('PATCH /api/team/members/:id', { timeout: 30_000 }, () => {
  it('promotes and demotes, writing audit rows', async () => {
    const { admin, member } = await orgWithMember();
    expect((await patch(admin.accessToken, member.id, { role: 'ADMIN' })).body.member.role).toBe('ADMIN');
    expect((await patch(admin.accessToken, member.id, { role: 'MEMBER' })).body.member.role).toBe('MEMBER');
    const roleChanges = await prisma.auditLog.count({
      where: { orgId: admin.orgId, action: 'MEMBER_ROLE_CHANGED' },
    });
    expect(roleChanges).toBe(2);
  });

  it('deactivating a member ends their sessions at once', async () => {
    const { admin, member, memberCookie } = await orgWithMember();
    const res = await patch(admin.accessToken, member.id, { isActive: false });
    expect(res.body.member.isActive).toBe(false);
    expect((await request(app).get('/api/auth/me').set(bearer(member.token))).status).toBe(401);
    expect((await refresh(app, memberCookie)).status).toBe(401);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: 'a-long-password-1' });
    expect(login.status).toBe(403);
  });

  it('reactivated members can log in again', async () => {
    const { admin, member } = await orgWithMember();
    await patch(admin.accessToken, member.id, { isActive: false });
    await patch(admin.accessToken, member.id, { isActive: true });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.email, password: 'a-long-password-1' });
    expect(login.status).toBe(200);
  });

  it('a role change ends the old token, so a demoted admin loses admin access immediately', async () => {
    const { admin, member } = await orgWithMember('ADMIN');
    await patch(admin.accessToken, member.id, { role: 'MEMBER' });
    expect((await request(app).get('/api/team/invites').set(bearer(member.token))).status).toBe(401);
  });

  it('the last active admin cannot be demoted or deactivated, even by themselves', async () => {
    const { admin } = await orgWithMember();
    for (const body of [{ role: 'MEMBER' }, { isActive: false }]) {
      const res = await patch(admin.accessToken, admin.userId, body);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_ADMIN');
    }
  });

  it('an admin can step down when another admin exists', async () => {
    const { admin } = await orgWithMember('ADMIN');
    expect((await patch(admin.accessToken, admin.userId, { role: 'MEMBER' })).status).toBe(200);
  });

  it('two admins demoting each other at the same time leave one admin', async () => {
    const { admin, member } = await orgWithMember('ADMIN');
    const results = await Promise.all([
      patch(admin.accessToken, member.id, { role: 'MEMBER' }),
      patch(member.token, admin.userId, { role: 'MEMBER' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { orgId: admin.orgId, role: 'ADMIN', isActive: true } })).toBe(1);
  });

  it('members cannot change anyone', async () => {
    const { admin, member } = await orgWithMember();
    expect((await patch(member.token, admin.userId, { role: 'MEMBER' })).status).toBe(403);
    expect((await patch(member.token, member.id, { role: 'ADMIN' })).status).toBe(403);
  });

  it('validates the body and rejects SUPERADMIN', async () => {
    const { admin, member } = await orgWithMember();
    expect((await patch(admin.accessToken, member.id, {})).status).toBe(400);
    expect((await patch(admin.accessToken, member.id, { role: 'SUPERADMIN' })).status).toBe(400);
    expect((await patch(admin.accessToken, member.id, { isActive: 'no' })).status).toBe(400);
  });

  it('404s for unknown and malformed ids', async () => {
    const { admin } = await orgWithMember();
    expect(
      (await patch(admin.accessToken, '00000000-0000-4000-8000-000000000000', { role: 'MEMBER' })).status,
    ).toBe(404);
    expect((await patch(admin.accessToken, 'not-a-uuid', { role: 'MEMBER' })).status).toBe(404);
  });
});
