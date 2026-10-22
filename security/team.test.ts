// Phase 3 attack tests: cross-tenant access, role escalation, mass assignment and invite-token abuse on team routes.
import { randomBytes, randomUUID } from 'node:crypto';
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

async function orgWithMemberAndInvite() {
  const admin = await register(app);
  const memberEmail = `member-${randomUUID()}@example.test`;
  await request(app)
    .post('/api/team/invites')
    .set(bearer(admin.accessToken))
    .send({ email: memberEmail })
    .expect(201);
  const joined = await request(app)
    .post(`/api/auth/invites/${mail.lastInviteToken(memberEmail)}/accept`)
    .send({ name: 'Member', password: 'a-long-password-1' })
    .expect(201);
  const pending = await request(app)
    .post('/api/team/invites')
    .set(bearer(admin.accessToken))
    .send({ email: `pending-${randomUUID()}@example.test` })
    .expect(201);
  return {
    admin,
    member: { id: joined.body.user.id as string, token: joined.body.accessToken as string },
    inviteId: pending.body.invite.id as string,
  };
}

describe('cross-org IDOR', { timeout: 60_000 }, () => {
  it("org B's admin cannot read, change or revoke anything of org A", async () => {
    const a = await orgWithMemberAndInvite();
    const b = await register(app);
    const t = bearer(b.accessToken);

    const members = await request(app).get('/api/team/members').set(t);
    expect(members.body.members.map((m: { id: string }) => m.id)).toEqual([b.userId]);
    const invites = await request(app).get('/api/team/invites').set(t);
    expect(invites.body.invites).toEqual([]);

    for (const body of [{ role: 'ADMIN' }, { isActive: false }]) {
      expect((await request(app).patch(`/api/team/members/${a.member.id}`).set(t).send(body)).status).toBe(
        404,
      );
      expect((await request(app).patch(`/api/team/members/${a.admin.userId}`).set(t).send(body)).status).toBe(
        404,
      );
    }
    expect((await request(app).delete(`/api/team/invites/${a.inviteId}`).set(t)).status).toBe(404);

    const target = await prisma.user.findUniqueOrThrow({ where: { id: a.member.id } });
    expect(target).toMatchObject({ role: 'MEMBER', isActive: true });
    expect((await prisma.invite.findUniqueOrThrow({ where: { id: a.inviteId } })).status).toBe('PENDING');
  });

  it('org ids smuggled in headers, query or body change nothing', async () => {
    const a = await orgWithMemberAndInvite();
    const b = await register(app);
    const res = await request(app)
      .get('/api/team/members')
      .set({ ...bearer(b.accessToken), 'x-org-id': a.admin.orgId })
      .query({ orgId: a.admin.orgId });
    expect(res.body.members).toHaveLength(1);

    await request(app)
      .post('/api/team/invites')
      .set(bearer(b.accessToken))
      .send({ email: 'smuggle@example.test', orgId: a.admin.orgId })
      .expect(201);
    expect((await prisma.invite.findFirstOrThrow({ where: { email: 'smuggle@example.test' } })).orgId).toBe(
      b.orgId,
    );
  });
});

describe('role escalation', { timeout: 60_000 }, () => {
  it('a member cannot use any admin route', async () => {
    const { admin, member, inviteId } = await orgWithMemberAndInvite();
    const t = bearer(member.token);
    expect((await request(app).get('/api/team/invites').set(t)).status).toBe(403);
    expect(
      (await request(app).post('/api/team/invites').set(t).send({ email: 'x@example.test' })).status,
    ).toBe(403);
    expect((await request(app).delete(`/api/team/invites/${inviteId}`).set(t)).status).toBe(403);
    expect(
      (await request(app).patch(`/api/team/members/${member.id}`).set(t).send({ role: 'ADMIN' })).status,
    ).toBe(403);
    expect(
      (await request(app).patch(`/api/team/members/${admin.userId}`).set(t).send({ isActive: false })).status,
    ).toBe(403);
  });

  it('nobody can hand out SUPERADMIN', async () => {
    const { admin, member } = await orgWithMemberAndInvite();
    const t = bearer(admin.accessToken);
    expect(
      (await request(app).patch(`/api/team/members/${member.id}`).set(t).send({ role: 'SUPERADMIN' })).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/team/invites')
          .set(t)
          .send({ email: 's@example.test', role: 'SUPERADMIN' })
      ).status,
    ).toBe(400);
  });

  it('an invite accept body cannot choose its own role or email', async () => {
    const admin = await register(app);
    await request(app)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: 'low@example.test' });
    const res = await request(app)
      .post(`/api/auth/invites/${mail.lastInviteToken('low@example.test')}/accept`)
      .send({
        name: 'x',
        password: 'a-long-password-1',
        role: 'ADMIN',
        email: 'other@example.test',
        orgId: randomUUID(),
      });
    expect(res.body.user).toMatchObject({ role: 'MEMBER', email: 'low@example.test' });
    expect(res.body.organization.id).toBe(admin.orgId);
  });

  it('PATCH ignores email, orgId, passwordHash and id in the body', async () => {
    const { admin, member } = await orgWithMemberAndInvite();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    await request(app)
      .patch(`/api/team/members/${member.id}`)
      .set(bearer(admin.accessToken))
      .send({
        isActive: true,
        email: 'hijack@example.test',
        orgId: randomUUID(),
        passwordHash: 'x',
        id: randomUUID(),
      })
      .expect(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    expect(after).toMatchObject({
      email: before.email,
      orgId: before.orgId,
      passwordHash: before.passwordHash,
    });
  });

  it('a superadmin token (no org) gets no team access', async () => {
    const user = await prisma.user.create({
      data: { email: 'root@example.test', name: 'Root', passwordHash: 'x', role: 'SUPERADMIN' },
    });
    const sid = randomUUID();
    await redis.set(sessionKey(sid), user.id, 'EX', 60);
    const { token } = await signAccessToken(TEST_JWT_SECRET, {
      userId: user.id,
      orgId: null,
      role: 'SUPERADMIN',
      sid,
    });
    expect((await request(app).get('/api/team/members').set(bearer(token))).status).toBe(403);
  });

  it("a deactivated member's live token stops working immediately", async () => {
    const { admin, member } = await orgWithMemberAndInvite();
    await request(app)
      .patch(`/api/team/members/${member.id}`)
      .set(bearer(admin.accessToken))
      .send({ isActive: false });
    expect((await request(app).get('/api/team/members').set(bearer(member.token))).status).toBe(401);
  });
});

describe('invite token abuse', { timeout: 60_000 }, () => {
  it('guessed, truncated, padded and injected tokens all get the same 404', async () => {
    const admin = await register(app);
    await request(app)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: 'real@example.test' });
    const real = mail.lastInviteToken('real@example.test');
    const candidates = [
      randomBytes(32).toString('base64url'),
      real.slice(0, -1),
      `${real}A`,
      real.toUpperCase() === real ? real.toLowerCase() : real.toUpperCase(),
      "' OR 1=1 --",
      '..%2F..%2Fetc%2Fpasswd',
    ];
    const bodies = new Set<string>();
    for (const c of candidates) {
      const res = await request(app).get(`/api/auth/invites/${encodeURIComponent(c)}`);
      expect(res.status).toBe(404);
      bodies.add(JSON.stringify(res.body));
    }
    expect(bodies.size).toBe(1);
  });

  it('token guessing is rate limited', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      statuses.push(
        (await request(app).get(`/api/auth/invites/${randomBytes(32).toString('base64url')}`)).status,
      );
    }
    expect(statuses.at(-1)).toBe(429);
  });

  it('two simultaneous accepts of one invite create one user', async () => {
    const admin = await register(app);
    await request(app)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: 'race@example.test' });
    const token = mail.lastInviteToken('race@example.test');
    const body = { name: 'Racer', password: 'a-long-password-1' };
    const results = await Promise.all([
      request(app).post(`/api/auth/invites/${token}/accept`).send(body),
      request(app).post(`/api/auth/invites/${token}/accept`).send(body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 404]);
    expect(await prisma.user.count({ where: { email: 'race@example.test' } })).toBe(1);
  });

  it('only the hash of the token is stored', async () => {
    const admin = await register(app);
    await request(app)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: 'hash@example.test' });
    const token = mail.lastInviteToken('hash@example.test');
    const row = await prisma.invite.findFirstOrThrow({ where: { email: 'hash@example.test' } });
    expect(JSON.stringify(row)).not.toContain(token);
  });
});

describe('injection on team routes', { timeout: 60_000 }, () => {
  it('CRLF in an invite email (header injection) is rejected', async () => {
    const admin = await register(app);
    for (const email of [
      'a@example.test\r\nBcc: evil@example.test',
      'a@example.test\nSubject: hi',
      'a@example.test, evil@example.test',
    ]) {
      expect(
        (await request(app).post('/api/team/invites').set(bearer(admin.accessToken)).send({ email })).status,
      ).toBe(400);
    }
    expect(mail.sent).toHaveLength(0);
  });

  it('SQL in the :id parameter is just a 404', async () => {
    const admin = await register(app);
    for (const id of ["1' OR '1'='1", '00000000-0000-0000-0000-000000000000; DROP TABLE "user"', '%00']) {
      const res = await request(app)
        .patch(`/api/team/members/${encodeURIComponent(id)}`)
        .set(bearer(admin.accessToken))
        .send({ role: 'MEMBER' });
      expect(res.status).toBe(404);
    }
  });
});
