import type { Express } from 'express';
import request from 'supertest';
import { REFRESH_COOKIE } from '../auth/routes.js';

let counter = 0;

/** A unique registration payload per call. */
export function newAccount(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    name: `User ${counter}`,
    email: `user${counter}-${Date.now()}@example.test`,
    password: 'correct-horse-battery',
    organizationName: `Org ${counter}`,
    ...overrides,
  };
}

/** Pulls the refresh cookie out of a response, as `name=value` ready to send back. */
export function refreshCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`) && !c.startsWith(`${REFRESH_COOKIE}=;`));
  return cookie?.split(';')[0];
}

export async function register(app: Express, overrides: Record<string, unknown> = {}) {
  const account = newAccount(overrides);
  const res = await request(app).post('/api/auth/register').send(account);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    account,
    res,
    accessToken: res.body.accessToken as string,
    cookie: refreshCookie(res)!,
    orgId: res.body.organization.id as string,
    userId: res.body.user.id as string,
  };
}

export const refresh = (app: Express, cookie: string) =>
  request(app).post('/api/auth/refresh').set('cookie', cookie).set('x-requested-with', 'fetch');
