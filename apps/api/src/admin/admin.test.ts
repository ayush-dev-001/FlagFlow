import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../auth/passwords.js';
import { closeApp, createApp } from '../app.js';
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
import { listen, openStream, type TestStream } from '../test/server.js';

let prisma: PrismaClient;
let redis: Redis;
let app: Express;
let server: Awaited<ReturnType<typeof listen>>;
const streams: TestStream[] = [];

beforeAll(() => {
  prisma = connectTestDb();
  redis = connectTestRedis();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  await resetRedis(redis);
  app = createApp({
    ...testDeps(prisma, redis, {}, captureMailer().mailer),
    streamOptions: { heartbeatMs: 200 },
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
const PASSWORD = 'superadmin-password-1';

async function superadmin() {
  const email = `root${Date.now()}@example.test`;
  await prisma.user.create({
    data: {
      email,
      name: 'Root',
      role: 'SUPERADMIN',
      orgId: null,
      passwordHash: await hashPassword(PASSWORD),
    },
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken as string;
}

describe('/api/admin/organizations', { timeout: 30_000 }, () => {
  it('lists every organization with counts, for superadmins only', async () => {
    const root = await superadmin();
    const a = await register(app);
    await register(app);
    await request(app).post('/api/flags').set(bearer(a.accessToken)).send({ key: 'dark_mode' }).expect(201);

    const res = await request(app).get('/api/admin/organizations').set(bearer(root)).expect(200);
    expect(res.body.organizations).toHaveLength(2);
    expect(res.body.organizations[0]).toMatchObject({
      id: a.orgId,
      isActive: true,
      members: 1,
      flags: 1,
      activeApiKeys: 1,
    });

    expect((await request(app).get('/api/admin/organizations').set(bearer(a.accessToken))).status).toBe(403);
    expect((await request(app).get('/api/admin/organizations')).status).toBe(401);
  });

  it('deactivating ends sessions and open streams at once, and writes an audit row', async () => {
    const root = await superadmin();
    const org = await register(app);
    const stream = await openStream(server.baseUrl, org.res.body.apiKey.key as string);
    streams.push(stream);
    await stream.next('snapshot');

    const res = await request(app)
      .patch(`/api/admin/organizations/${org.orgId}`)
      .set(bearer(root))
      .send({ isActive: false })
      .expect(200);
    expect(res.body.organization.isActive).toBe(false);

    // The live access token stops working right away, and so does the refresh cookie.
    expect((await request(app).get('/api/flags').set(bearer(org.accessToken))).status).toBe(401);
    expect((await refresh(app, org.cookie)).status).toBe(401);
    expect(JSON.parse((await stream.next('error')).data)).toMatchObject({ code: 'API_KEY_REVOKED' });
    expect(
      (
        await request(app)
          .get('/v1/snapshot')
          .set('x-api-key', org.res.body.apiKey.key as string)
      ).status,
    ).toBe(401);
    expect(await prisma.auditLog.count({ where: { orgId: org.orgId, action: 'ORG_STATUS_CHANGED' } })).toBe(
      1,
    );

    // Reactivating lets its people log in again.
    await request(app)
      .patch(`/api/admin/organizations/${org.orgId}`)
      .set(bearer(root))
      .send({ isActive: true })
      .expect(200);
    await request(app)
      .post('/api/auth/login')
      .send({ email: org.account.email, password: org.account.password })
      .expect(200);
  });

  it('rejects unknown ids, bad bodies and org admins', async () => {
    const root = await superadmin();
    const org = await register(app);
    const patch = (token: string, id: string, body: unknown) =>
      request(app)
        .patch(`/api/admin/organizations/${id}`)
        .set(bearer(token))
        .send(body as object);
    expect((await patch(root, '00000000-0000-7000-8000-000000000000', { isActive: false })).status).toBe(404);
    expect((await patch(root, org.orgId, { isActive: 'no' })).status).toBe(400);
    expect((await patch(root, org.orgId, { name: 'Renamed' })).status).toBe(400);
    expect((await patch(org.accessToken, org.orgId, { isActive: false })).status).toBe(403);
  });
});
