import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { PrismaClient } from '../db.js';
import type { Redis } from '../redis.js';
import { newAccount, refresh, refreshCookie, register } from '../test/auth.js';
import { connectTestDb, connectTestRedis, resetDatabase, resetRedis, testDeps } from '../test/helpers.js';
import { sha256 } from './tokens.js';

let prisma: PrismaClient;
let redis: Redis;
let app: Express;

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
  app = createApp(testDeps(prisma, redis));
});
beforeEach(async () => {
  await resetDatabase(prisma);
  await resetRedis(redis);
});
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

const me = (token: string) => request(app).get('/api/auth/me').set('authorization', `Bearer ${token}`);

describe('POST /api/auth/register', { timeout: 20_000 }, () => {
  it('creates org, admin and a first API key that is stored only as a hash', async () => {
    const { res, orgId, userId } = await register(app);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.apiKey.key).toMatch(/^ff_live_[A-Za-z0-9_-]{32}$/);

    const key = await prisma.apiKey.findFirstOrThrow({ where: { orgId } });
    expect(key.keyHash).toBe(sha256(res.body.apiKey.key));
    expect(key.prefix).toBe(res.body.apiKey.key.slice(0, 12));
    expect(JSON.stringify(key)).not.toContain(res.body.apiKey.key);

    const actions = (await prisma.auditLog.findMany({ where: { orgId } })).map((a) => [a.action, a.actorId]);
    expect(actions).toEqual([
      ['ORG_CREATED', userId],
      ['API_KEY_CREATED', userId],
    ]);
  });

  it('sets a hardened refresh cookie', async () => {
    const { res } = await register(app);
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('ignores role, orgId and id in the body (mass assignment)', async () => {
    const other = await register(app);
    const { res, userId } = await register(app, { role: 'SUPERADMIN', orgId: other.orgId, id: other.userId });
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.organization.id).not.toBe(other.orgId);
    expect(userId).not.toBe(other.userId);
  });

  it('rejects a duplicate email, case-insensitively', async () => {
    const { account } = await register(app);
    const res = await request(app)
      .post('/api/auth/register')
      .send(newAccount({ email: account.email.toUpperCase() }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(newAccount({ email: 'nope', password: 'short' }));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password']);
  });

  it('rejects passwords over 72 bytes', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(newAccount({ password: 'é'.repeat(40) }));
    expect(res.status).toBe(400);
  });

  it('gives each org a unique slug', async () => {
    const a = await register(app, { organizationName: 'Same Name' });
    const b = await register(app, { organizationName: 'Same Name' });
    expect(a.res.body.organization.slug).toBe('same-name');
    expect(b.res.body.organization.slug).toMatch(/^same-name-[0-9a-f]{6}$/);
  });
});

describe('POST /api/auth/login', { timeout: 20_000 }, () => {
  it('logs in and returns a working access token', async () => {
    const { account } = await register(app);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password });
    expect(res.status).toBe(200);
    expect(refreshCookie(res)).toBeDefined();
    expect((await me(res.body.accessToken)).body.user.email).toBe(account.email);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { account } = await register(app);
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'wrong-password' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.test', password: 'x' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('refuses a deactivated user and a deactivated org', async () => {
    const a = await register(app);
    await prisma.user.update({ where: { id: a.userId }, data: { isActive: false } });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: a.account.email, password: a.account.password });
    expect(res.status).toBe(403);

    const b = await register(app);
    await prisma.organization.update({ where: { id: b.orgId }, data: { isActive: false } });
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ email: b.account.email, password: b.account.password });
    expect(res2.status).toBe(403);
  });

  it('allows 5 attempts per minute per IP + email, then 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@example.test', password: 'guess' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  });
});

describe('POST /api/auth/refresh', { timeout: 20_000 }, () => {
  it('rotates the cookie and returns a new access token', async () => {
    const { cookie } = await register(app);
    const res = await refresh(app, cookie);
    expect(res.status).toBe(200);
    expect(refreshCookie(res)).not.toBe(cookie);
    expect((await me(res.body.accessToken)).status).toBe(200);
  });

  it('revokes the whole session when an old refresh token is reused', async () => {
    const { cookie } = await register(app);
    const first = await refresh(app, cookie);
    const rotated = refreshCookie(first)!;

    const reuse = await refresh(app, cookie);
    expect(reuse.status).toBe(401);
    // The thief's replay also kills the legitimate holder's newer token and access token.
    expect((await refresh(app, rotated)).status).toBe(401);
    expect((await me(first.body.accessToken)).status).toBe(401);
  });

  it('requires X-Requested-With (CSRF)', async () => {
    const { cookie } = await register(app);
    const res = await request(app).post('/api/auth/refresh').set('cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_CHECK_FAILED');
  });

  it('rejects missing, malformed and forged tokens', async () => {
    expect((await request(app).post('/api/auth/refresh').set('x-requested-with', 'fetch')).status).toBe(401);
    expect((await refresh(app, 'ff_refresh=garbage')).status).toBe(401);
    const { cookie } = await register(app);
    const [sid] = cookie.replace('ff_refresh=', '').split('.');
    expect((await refresh(app, `ff_refresh=${sid}.${'A'.repeat(43)}`)).status).toBe(401);
  });

  it('refuses to refresh for a user deactivated after login', async () => {
    const { cookie, userId } = await register(app);
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    expect((await refresh(app, cookie)).status).toBe(401);
  });
});

describe('logout and /me', { timeout: 20_000 }, () => {
  it('revokes the session and denylists the access token', async () => {
    const { accessToken, cookie } = await register(app);
    const res = await request(app).post('/api/auth/logout').set('authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);
    expect((await me(accessToken)).status).toBe(401);
    expect((await refresh(app, cookie)).status).toBe(401);
  });

  it('returns the current user and org', async () => {
    const { accessToken, account, orgId } = await register(app);
    const res = await me(accessToken);
    expect(res.body).toMatchObject({
      user: { email: account.email, role: 'ADMIN' },
      organization: { id: orgId },
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('requires a bearer token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('authorization', 'Basic abc')).status).toBe(401);
  });

  it('logs out when the Redis session is gone, and refresh restores it from Postgres', async () => {
    const { accessToken, cookie } = await register(app);
    await resetRedis(redis);
    expect((await me(accessToken)).status).toBe(401);
    const res = await refresh(app, cookie);
    expect(res.status).toBe(200);
    expect((await me(res.body.accessToken)).status).toBe(200);
  });
});
