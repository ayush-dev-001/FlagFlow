import { randomUUID } from 'node:crypto';
import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from '../errors.js';
import type { Role } from '../generated/prisma/client.js';
import type { Redis } from '../redis.js';
import { connectTestRedis, silentLogger, TEST_JWT_SECRET } from '../test/helpers.js';
import { requireAuth, requireRole } from './middleware.js';
import { sessionKey } from './sessions.js';
import { signAccessToken } from './tokens.js';

let redis: Redis;
beforeAll(() => {
  redis = connectTestRedis();
});
afterAll(async () => {
  await redis.quit();
});

function adminOnlyApp() {
  const app = express();
  app.use(pinoHttp({ logger: silentLogger }));
  app.get('/admin', requireAuth(TEST_JWT_SECRET, redis), requireRole('ADMIN', 'SUPERADMIN'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

async function tokenFor(role: Role) {
  const sid = randomUUID();
  await redis.set(sessionKey(sid), 'user', 'EX', 60);
  const { token } = await signAccessToken(TEST_JWT_SECRET, {
    userId: randomUUID(),
    orgId: randomUUID(),
    role,
    sid,
  });
  return token;
}

describe('requireRole', () => {
  it('lets allowed roles through', async () => {
    const res = await request(adminOnlyApp())
      .get('/admin')
      .set('authorization', `Bearer ${await tokenFor('ADMIN')}`);
    expect(res.status).toBe(200);
  });

  it('forbids other roles', async () => {
    const res = await request(adminOnlyApp())
      .get('/admin')
      .set('authorization', `Bearer ${await tokenFor('MEMBER')}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
