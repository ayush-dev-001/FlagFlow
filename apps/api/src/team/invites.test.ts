import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { PrismaClient } from '../db.js';
import { createMailer } from '../mailer.js';
import type { Redis } from '../redis.js';
import { register } from '../test/auth.js';
import {
  captureMailer,
  connectTestDb,
  connectTestRedis,
  DASHBOARD_ORIGIN,
  resetDatabase,
  resetRedis,
  testDeps,
} from '../test/helpers.js';
import { MAILPIT_SMTP_URL, waitForMail } from '../test/mailpit.js';
import { INVITE_TTL_MS } from './routes.js';

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
const invite = (token: string, body: object) =>
  request(app).post('/api/team/invites').set(bearer(token)).send(body);
const accept = (inviteToken: string, body = { name: 'New Member', password: 'a-long-password-1' }) =>
  request(app).post(`/api/auth/invites/${inviteToken}/accept`).send(body);

describe('invites', { timeout: 30_000 }, () => {
  it('invited user can preview, accept and is logged in to the right org with the invited role', async () => {
    const admin = await register(app);
    expect((await invite(admin.accessToken, { email: 'new@example.test', role: 'MEMBER' })).status).toBe(201);
    const token = mail.lastInviteToken('new@example.test');
    expect(mail.sent[0]!.link).toBe(`${DASHBOARD_ORIGIN}/invite/${token}`);

    const preview = await request(app).get(`/api/auth/invites/${token}`);
    expect(preview.body).toEqual({
      email: 'new@example.test',
      role: 'MEMBER',
      organization: { name: admin.account.organizationName },
    });

    const res = await accept(token);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@example.test', role: 'MEMBER' });
    expect(res.body.organization.id).toBe(admin.orgId);
    const me = await request(app).get('/api/auth/me').set(bearer(res.body.accessToken));
    expect(me.body.organization.id).toBe(admin.orgId);

    const actions = (
      await prisma.auditLog.findMany({ where: { orgId: admin.orgId }, orderBy: { id: 'asc' } })
    ).map((a) => a.action);
    expect(actions).toEqual(['ORG_CREATED', 'API_KEY_CREATED', 'MEMBER_INVITED', 'INVITE_ACCEPTED']);
  });

  it('a used invite cannot be used again', async () => {
    const admin = await register(app);
    await invite(admin.accessToken, { email: 'once@example.test' });
    const token = mail.lastInviteToken('once@example.test');
    expect((await accept(token)).status).toBe(201);
    expect((await accept(token)).status).toBe(404);
    expect((await request(app).get(`/api/auth/invites/${token}`)).status).toBe(404);
  });

  it('an expired invite fails', async () => {
    const admin = await register(app);
    await invite(admin.accessToken, { email: 'late@example.test' });
    const token = mail.lastInviteToken('late@example.test');
    await prisma.invite.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await accept(token)).status).toBe(404);
    const list = await request(app).get('/api/team/invites').set(bearer(admin.accessToken));
    expect(list.body.invites[0].status).toBe('EXPIRED');
  });

  it('expires 48 hours after it is sent', async () => {
    const admin = await register(app);
    const before = Date.now();
    await invite(admin.accessToken, { email: 'ttl@example.test' });
    const row = await prisma.invite.findFirstOrThrow();
    expect(row.expiresAt.getTime() - before).toBeGreaterThanOrEqual(INVITE_TTL_MS - 1000);
    expect(row.expiresAt.getTime() - before).toBeLessThanOrEqual(INVITE_TTL_MS + 5000);
  });

  it('a revoked invite fails', async () => {
    const admin = await register(app);
    const created = await invite(admin.accessToken, { email: 'gone@example.test' });
    const token = mail.lastInviteToken('gone@example.test');
    const del = await request(app)
      .delete(`/api/team/invites/${created.body.invite.id}`)
      .set(bearer(admin.accessToken));
    expect(del.status).toBe(204);
    expect((await accept(token)).status).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/team/invites/${created.body.invite.id}`)
          .set(bearer(admin.accessToken))
      ).status,
    ).toBe(404);
  });

  it('re-inviting the same email replaces the old link', async () => {
    const admin = await register(app);
    await invite(admin.accessToken, { email: 'twice@example.test' });
    const first = mail.lastInviteToken('twice@example.test');
    await invite(admin.accessToken, { email: 'twice@example.test', role: 'ADMIN' });
    const second = mail.lastInviteToken('twice@example.test');
    expect((await accept(first)).status).toBe(404);
    const res = await accept(second);
    expect(res.body.user.role).toBe('ADMIN');
  });

  it('refuses to invite an email that already has an account', async () => {
    const admin = await register(app);
    const other = await register(app);
    expect((await invite(admin.accessToken, { email: other.account.email })).status).toBe(409);
    expect((await invite(admin.accessToken, { email: admin.account.email })).status).toBe(409);
  });

  it('a deactivated org cannot onboard members', async () => {
    const admin = await register(app);
    await invite(admin.accessToken, { email: 'blocked@example.test' });
    await prisma.organization.update({ where: { id: admin.orgId }, data: { isActive: false } });
    expect((await accept(mail.lastInviteToken('blocked@example.test'))).status).toBe(404);
  });

  it('only admins can invite, list and revoke', async () => {
    const admin = await register(app);
    await invite(admin.accessToken, { email: 'member@example.test' });
    const member = await accept(mail.lastInviteToken('member@example.test'));
    const t = member.body.accessToken as string;
    expect((await invite(t, { email: 'x@example.test' })).status).toBe(403);
    expect((await request(app).get('/api/team/invites').set(bearer(t))).status).toBe(403);
  });

  it('validates the accept body', async () => {
    const admin = await register(app);
    await invite(admin.accessToken, { email: 'weak@example.test' });
    const res = await accept(mail.lastInviteToken('weak@example.test'), { name: '', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('invite email through Mailpit', { timeout: 30_000 }, () => {
  it('delivers a link that lets the invitee join', async () => {
    const real = createApp(
      testDeps(
        prisma,
        redis,
        {},
        createMailer({ SMTP_URL: MAILPIT_SMTP_URL, MAIL_FROM: 'FlagFlow <no-reply@flagflow.local>' }),
      ),
    );
    const admin = await register(real, { name: 'Ada <b>Admin</b>', organizationName: 'Acme & <i>Co</i>' });
    const to = `mailpit-${Date.now()}@example.test`;
    await request(real)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: to })
      .expect(201);

    const msg = await waitForMail(to);
    expect(msg.Subject).toBe("You're invited to Acme & <i>Co</i> on FlagFlow");
    // User-supplied names are escaped in the HTML part.
    expect(msg.HTML).toContain('Acme &amp; &lt;i&gt;Co&lt;/i&gt;');
    expect(msg.HTML).not.toContain('<i>Co</i>');

    const token = /\/invite\/([A-Za-z0-9_-]{43})/.exec(msg.Text)?.[1];
    expect(token).toBeDefined();
    const res = await request(real)
      .post(`/api/auth/invites/${token}/accept`)
      .send({ name: 'From Mailpit', password: 'a-long-password-1' });
    expect(res.status).toBe(201);
    expect(res.body.organization.id).toBe(admin.orgId);
  });
});

describe('when the invite email cannot be sent', { timeout: 30_000 }, () => {
  it('answers 502 at once and cancels the invite, so no dead link is left pending', async () => {
    const failing = createApp(
      testDeps(prisma, redis, {}, { sendInvite: () => Promise.reject(new Error('connect ETIMEDOUT')) }),
    );
    const admin = await register(failing);
    const res = await request(failing)
      .post('/api/team/invites')
      .set(bearer(admin.accessToken))
      .send({ email: 'someone@example.test' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EMAIL_NOT_SENT');
    expect(JSON.stringify(res.body)).not.toContain('ETIMEDOUT');
    const stored = await prisma.invite.findMany({ where: { orgId: admin.orgId } });
    expect(stored.map((i) => i.status)).toEqual(['REVOKED']);
  });

  it('times out on an unreachable SMTP server in seconds, not minutes', async () => {
    // 10.255.255.1 is a non-routable address: the connection just hangs, like a blocked port.
    const mailer = createMailer({
      SMTP_URL: 'smtps://u:p@10.255.255.1:2465',
      MAIL_FROM: 'x <x@example.test>',
    });
    const started = Date.now();
    await expect(
      mailer.sendInvite({
        to: 'a@example.test',
        organizationName: 'Org',
        inviterName: 'Ada',
        role: 'MEMBER',
        link: `${DASHBOARD_ORIGIN}/invite/t`,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      }),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(15_000);
  });
});
