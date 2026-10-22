// Phase 2 attack tests: JWT tampering, session abuse, brute force, injection and timing on the auth routes.
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../apps/api/src/app.js';
import { sessionKey } from '../apps/api/src/auth/sessions.js';
import type { PrismaClient } from '../apps/api/src/db.js';
import type { Redis } from '../apps/api/src/redis.js';
import { refresh, register } from '../apps/api/src/test/auth.js';
import {
  connectTestDb,
  connectTestRedis,
  DASHBOARD_ORIGIN,
  resetDatabase,
  resetRedis,
  TEST_JWT_SECRET,
  testDeps,
} from '../apps/api/src/test/helpers.js';

let prisma: PrismaClient;
let redis: Redis;
let app: Express;

beforeAll(async () => {
  prisma = connectTestDb();
  redis = connectTestRedis();
  app = createApp(testDeps(prisma, redis));
  await resetDatabase(prisma);
});
beforeEach(async () => {
  await resetRedis(redis);
});
afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const me = (token: string) => request(app).get('/api/auth/me').set('authorization', `Bearer ${token}`);
const login = (body: object, headers: Record<string, string> = {}) =>
  request(app).post('/api/auth/login').set(headers).send(body);

/** A token signed exactly like a real one, with any claims and secret the attacker likes. */
async function forge(claims: Record<string, unknown>, opts: { secret?: string; exp?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: 'ADMIN', org: randomUUID(), sid: randomUUID(), ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject((claims.sub as string) ?? randomUUID())
    .setJti(randomUUID())
    .setIssuer('flagflow')
    .setAudience('flagflow-dashboard')
    .setIssuedAt(now - 60)
    .setExpirationTime(opts.exp ?? now + 600)
    .sign(new TextEncoder().encode(opts.secret ?? TEST_JWT_SECRET));
}

describe('JWT tampering', { timeout: 20_000 }, () => {
  it('rejects alg: none, with or without a signature', async () => {
    const victim = await register(app);
    const [, payload] = victim.accessToken.split('.');
    const header = b64({ alg: 'none', typ: 'JWT' });
    expect((await me(`${header}.${payload}.`)).status).toBe(401);
    expect((await me(`${header}.${payload}.x`)).status).toBe(401);
  });

  it('rejects other algorithms in the header (algorithm confusion)', async () => {
    const victim = await register(app);
    const [, payload, sig] = victim.accessToken.split('.');
    for (const alg of ['HS512', 'RS256', 'ES256']) {
      expect((await me(`${b64({ alg, typ: 'JWT' })}.${payload}.${sig}`)).status).toBe(401);
    }
  });

  it('rejects a token signed with the wrong secret', async () => {
    const victim = await register(app);
    const token = await forge(
      { sub: victim.userId, sid: randomUUID() },
      { secret: 'wrong-'.padEnd(64, 'y') },
    );
    expect((await me(token)).status).toBe(401);
  });

  it('rejects an expired token even if its session is live', async () => {
    const sid = randomUUID();
    await redis.set(sessionKey(sid), 'x', 'EX', 60);
    const token = await forge({ sid }, { exp: Math.floor(Date.now() / 1000) - 10 });
    expect((await me(token)).status).toBe(401);
  });

  it('rejects a payload edited to escalate role (signature no longer matches)', async () => {
    const victim = await register(app);
    const [header, payload, sig] = victim.accessToken.split('.');
    const claims = JSON.parse(Buffer.from(payload!, 'base64url').toString()) as Record<string, unknown>;
    const escalated = b64({ ...claims, role: 'SUPERADMIN', org: null });
    expect((await me(`${header}.${escalated}.${sig}`)).status).toBe(401);
  });

  it('rejects a validly signed token whose session never existed', async () => {
    expect((await me(await forge({ sid: randomUUID() }))).status).toBe(401);
  });

  it('rejects a denylisted token after logout, and logout cannot be replayed into a new session', async () => {
    const victim = await register(app);
    await request(app).post('/api/auth/logout').set('authorization', `Bearer ${victim.accessToken}`);
    expect((await me(victim.accessToken)).status).toBe(401);
    expect((await refresh(app, victim.cookie)).status).toBe(401);
  });

  it('an org A token only ever sees org A, whatever the caller sends', async () => {
    const a = await register(app);
    const b = await register(app);
    const res = await me(a.accessToken).set('x-org-id', b.orgId).query({ orgId: b.orgId });
    expect(res.body.organization.id).toBe(a.orgId);
  });

  it('rejects malformed Authorization headers', async () => {
    for (const h of [
      'Bearer',
      'Bearer ',
      'bearer x.y.z',
      'Bearer a.b',
      'Bearer a.b.c.d',
      `Bearer ${'a'.repeat(10_000)}`,
    ]) {
      expect((await request(app).get('/api/auth/me').set('authorization', h)).status).toBe(401);
    }
  });
});

describe('refresh token abuse', { timeout: 20_000 }, () => {
  it('a stolen token replayed after the victim refreshed revokes everything', async () => {
    const victim = await register(app);
    const legit = await refresh(app, victim.cookie);
    expect((await refresh(app, victim.cookie)).status).toBe(401);
    expect((await me(legit.body.accessToken)).status).toBe(401);
    const row = await prisma.session.findFirstOrThrow({ where: { userId: victim.userId } });
    expect(row.revokedAt).not.toBeNull();
  });

  it('a refresh token cannot be used as an access token, and vice versa', async () => {
    const victim = await register(app);
    expect((await me(victim.cookie.replace('ff_refresh=', ''))).status).toBe(401);
    expect((await refresh(app, `ff_refresh=${victim.accessToken}`)).status).toBe(401);
  });
});

describe('brute force and rate-limit bypass', { timeout: 30_000 }, () => {
  it('spoofed X-Forwarded-For does not reset the per-account limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await login(
        { email: 'victim@example.test', password: `guess-${i}` },
        { 'x-forwarded-for': `10.0.0.${i}` },
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(5)).toEqual([429, 429]);
  });

  it('case and whitespace variants of the email share one counter', async () => {
    const emails = [
      'victim@example.test',
      'VICTIM@example.test',
      ' victim@example.test',
      'Victim@Example.Test',
    ];
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++)
      statuses.push((await login({ email: emails[i % emails.length], password: 'x' })).status);
    expect(statuses[5]).toBe(429);
  });

  it('spraying many accounts from one IP hits the per-IP limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++)
      statuses.push((await login({ email: `spray${i}@example.test`, password: 'x' })).status);
    expect(statuses.at(-1)).toBe(429);
  });

  it('registration is rate limited per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++)
      statuses.push((await request(app).post('/api/auth/register').send({})).status);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe('injection and XSS payloads', { timeout: 30_000 }, () => {
  const sqli = [
    "' OR '1'='1",
    "admin@example.test'--",
    '"; DROP TABLE "user"; --',
    "' UNION SELECT * FROM session --",
  ];

  it('SQL injection in login fields is just a failed login', async () => {
    for (const p of sqli) {
      const res = await login({ email: p, password: p });
      expect([400, 401]).toContain(res.status);
    }
    expect(await prisma.user.count()).toBeGreaterThanOrEqual(0);
  });

  it('NoSQL-style operator objects are rejected by validation', async () => {
    for (const body of [
      { email: { $ne: null }, password: { $ne: null } },
      { email: ['a@b.c'], password: 'x' },
      { email: 'a@b.c', password: { $gt: '' } },
    ]) {
      expect((await login(body)).status).toBe(400);
    }
  });

  it('SQL injection in register fields is stored as plain text', async () => {
    const victim = await register(app, { name: sqli[2], organizationName: sqli[0] });
    const res = await me(victim.accessToken);
    expect(res.body.user.name).toBe(sqli[2]);
    expect(res.body.organization.name).toBe(sqli[0]);
  });

  it('stored XSS payloads come back as inert JSON strings', async () => {
    const xss = '<script>alert(document.cookie)</script><img src=x onerror=alert(1)>';
    const victim = await register(app, { name: xss, organizationName: `${xss} Org` });
    const res = await me(victim.accessToken);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.body.user.name).toBe(xss);
  });
});

describe('CORS on auth endpoints', () => {
  it('a foreign origin cannot make credentialed calls', async () => {
    const res = await request(app)
      .options('/api/auth/refresh')
      .set('origin', 'https://evil.example')
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'x-requested-with');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  it('the dashboard origin can', async () => {
    const res = await request(app)
      .options('/api/auth/refresh')
      .set('origin', DASHBOARD_ORIGIN)
      .set('access-control-request-method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe(DASHBOARD_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('login timing', { timeout: 60_000 }, () => {
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const time = async (body: object) => {
    const start = performance.now();
    await login(body);
    return performance.now() - start;
  };

  it('an unknown email takes about as long as a wrong password', async () => {
    const victim = await register(app);
    await resetRedis(redis);
    const wrong: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 4; i++) {
      wrong.push(await time({ email: victim.account.email, password: `wrong-${i}` }));
      unknown.push(await time({ email: `ghost${i}@example.test`, password: 'wrong' }));
    }
    const ratio = median(unknown) / median(wrong);
    // Both paths run one bcrypt compare at cost 12 (~100+ ms); without it the unknown path would be ~1 ms.
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.6);
  });
});
