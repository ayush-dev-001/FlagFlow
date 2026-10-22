import type { RequestHandler } from 'express';
import { AppError } from '../errors.js';
import type { Role } from '../generated/prisma/client.js';
import type { Redis } from '../redis.js';
import { denyKey, sessionKey } from './sessions.js';
import { type AccessClaims, verifyAccessToken } from './tokens.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireAuth. */
    auth?: AccessClaims;
  }
}

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'Missing, invalid or expired access token');

/** Verifies the bearer token, then checks Redis that it isn't denylisted and its session is still live. */
export function requireAuth(secret: string, redis: Redis): RequestHandler {
  return async (req, _res, next) => {
    const token = BEARER.exec(req.get('authorization') ?? '')?.[1];
    if (!token) throw unauthorized();

    let claims: AccessClaims;
    try {
      claims = await verifyAccessToken(secret, token);
    } catch {
      throw unauthorized();
    }

    const [denied, live] = await Promise.all([
      redis.exists(denyKey(claims.jti)),
      redis.exists(sessionKey(claims.sid)),
    ]);
    if (denied || !live) throw unauthorized();

    req.auth = claims;
    next();
  };
}

/** Must run after requireAuth. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!roles.includes(req.auth.role))
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this');
    next();
  };
}
