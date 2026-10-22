import { randomBytes } from 'node:crypto';
import { type CookieOptions, type Response, Router } from 'express';
import { generateApiKey } from '../apiKeys.js';
import { audit } from '../audit.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import { Prisma, Role } from '../generated/prisma/client.js';
import type { Organization, User } from '../generated/prisma/client.js';
import type { Limiters } from '../rateLimit.js';
import type { Redis } from '../redis.js';
import { requireAuth } from './middleware.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { loginBody, registerBody } from './schemas.js';
import type { Sessions } from './sessions.js';
import { signAccessToken } from './tokens.js';

export const REFRESH_COOKIE = 'ff_refresh';

export interface AuthDeps {
  prisma: PrismaClient;
  redis: Redis;
  sessions: Sessions;
  limiters: Limiters;
  jwtSecret: string;
}

const cookieOptions = (expiresAt: Date): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  // Only the auth endpoints ever receive the refresh token.
  path: '/api/auth',
  expires: expiresAt,
});

const toPublicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, role: u.role });
const toPublicOrg = (o: Organization | null) => (o ? { id: o.id, name: o.name, slug: o.slug } : null);

function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'org';
}

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

export function authRouter({ prisma, redis, sessions, limiters, jwtSecret }: AuthDeps): Router {
  const router = Router();
  const authed = [requireAuth(jwtSecret, redis), limiters.api];

  async function startSession(res: Response, user: User) {
    const session = await sessions.create(user.id);
    const access = await signAccessToken(jwtSecret, {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      sid: session.sid,
    });
    res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(session.expiresAt));
    return { accessToken: access.token, expiresIn: access.expiresIn };
  }

  router.post('/register', limiters.publicAuth, async (req, res) => {
    const body = registerBody.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw emailTaken();

    const passwordHash = await hashPassword(body.password);
    let slug = slugify(body.organizationName);
    if (await prisma.organization.findUnique({ where: { slug } }))
      slug = `${slug}-${randomBytes(3).toString('hex')}`;
    const apiKey = generateApiKey();

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: body.organizationName, slug } });
        const user = await tx.user.create({
          data: { orgId: org.id, email: body.email, name: body.name, passwordHash, role: Role.ADMIN },
        });
        const key = await tx.apiKey.create({
          data: { orgId: org.id, name: 'Default', prefix: apiKey.prefix, keyHash: apiKey.hash },
        });
        const base = { orgId: org.id, actorId: user.id, ip: req.ip };
        await audit(tx, { ...base, action: 'ORG_CREATED', metadata: { after: { name: org.name, slug } } });
        await audit(tx, {
          ...base,
          action: 'API_KEY_CREATED',
          metadata: { after: { name: key.name, prefix: key.prefix } },
        });
        return { org, user, key };
      });
    } catch (err) {
      // Lost a race with a concurrent registration for the same email.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw emailTaken();
      throw err;
    }

    const tokens = await startSession(res, result.user);
    res.status(201).json({
      ...tokens,
      user: toPublicUser(result.user),
      organization: toPublicOrg(result.org),
      apiKey: { id: result.key.id, name: result.key.name, prefix: result.key.prefix, key: apiKey.key },
    });
  });

  router.post('/login', limiters.loginPerIp, limiters.login, async (req, res) => {
    const { email, password } = loginBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, include: { org: true } });
    // Always run bcrypt, so unknown emails and wrong passwords take the same time.
    const valid = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !valid) throw invalidCredentials();
    if (!user.isActive || (user.org && !user.org.isActive)) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account is disabled');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await startSession(res, user);
    res.json({ ...tokens, user: toPublicUser(user), organization: toPublicOrg(user.org) });
  });

  router.post('/refresh', limiters.publicAuth, async (req, res) => {
    // CSRF: a cross-site form can't set custom headers, and SameSite=Strict keeps the cookie off cross-site requests.
    if (!req.get('x-requested-with')) {
      throw new AppError(403, 'CSRF_CHECK_FAILED', 'Missing X-Requested-With header');
    }
    const cookies = req.cookies as Record<string, unknown>;
    const token = cookies[REFRESH_COOKIE];
    if (typeof token !== 'string') throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'No session');

    let rotated;
    try {
      rotated = await sessions.rotate(token);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      throw err;
    }
    const access = await signAccessToken(jwtSecret, {
      userId: rotated.user.id,
      orgId: rotated.user.orgId,
      role: rotated.user.role,
      sid: rotated.sid,
    });
    res.cookie(REFRESH_COOKIE, rotated.refreshToken, cookieOptions(rotated.expiresAt));
    res.json({ accessToken: access.token, expiresIn: access.expiresIn });
  });

  router.post('/logout', ...authed, async (req, res) => {
    const { sid, jti, exp } = req.auth!;
    await sessions.revoke(sid);
    await sessions.denylist(jti, exp);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(204).end();
  });

  router.get('/me', ...authed, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, include: { org: true } });
    if (!user?.isActive) throw new AppError(401, 'UNAUTHORIZED', 'Missing, invalid or expired access token');
    res.json({ user: toPublicUser(user), organization: toPublicOrg(user.org) });
  });

  return router;
}
