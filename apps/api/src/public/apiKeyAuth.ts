import type { RequestHandler } from 'express';
import { sha256 } from '../auth/tokens.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import type { Logger } from '../logger.js';
import type { Redis } from '../redis.js';

export interface ApiKeyContext {
  keyId: string;
  orgId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireApiKey. */
    apiKey?: ApiKeyContext;
  }
}

// ARCHITECTURE §5: API key → org, cached 10 minutes, deleted when the key is revoked.
export const apiKeyCacheKey = (hash: string) => `ff:apikey:${hash}`;
const CACHE_TTL_SECONDS = 600;
const API_KEY = /^ff_live_[A-Za-z0-9_-]{32}$/;
/** Channel on which revocations are announced, so every instance can close that key's open streams. */
export const KEY_REVOKED_CHANNEL = 'ff:apikeys:revoked';

const invalidKey = () => new AppError(401, 'INVALID_API_KEY', 'Missing, invalid or revoked API key');

/**
 * Verifies `x-api-key`: SHA-256 → Redis → Postgres (revoked keys and disabled orgs never resolve).
 * `lastUsedAt` is written at most once a minute per key, so it isn't a write on every evaluation.
 */
export function requireApiKey(prisma: PrismaClient, redis: Redis, logger: Logger): RequestHandler {
  return async (req, _res, next) => {
    const key = req.get('x-api-key');
    if (!key || !API_KEY.test(key)) throw invalidKey();
    const hash = sha256(key);

    let ctx: ApiKeyContext | null = null;
    const cached = await redis.get(apiKeyCacheKey(hash));
    if (cached) {
      ctx = JSON.parse(cached) as ApiKeyContext;
    } else {
      const row = await prisma.apiKey.findFirst({
        where: { keyHash: hash, revokedAt: null, org: { isActive: true } },
        select: { id: true, orgId: true },
      });
      if (row) {
        ctx = { keyId: row.id, orgId: row.orgId };
        await redis.set(apiKeyCacheKey(hash), JSON.stringify(ctx), 'EX', CACHE_TTL_SECONDS);
      }
    }
    if (!ctx) throw invalidKey();

    // Bookkeeping, off the request path: one Redis round trip fewer on every evaluation.
    const keyId = ctx.keyId;
    void redis
      .set(`ff:apikey-used:${keyId}`, '1', 'EX', 60, 'NX')
      .then((fresh) =>
        fresh ? prisma.apiKey.update({ where: { id: keyId }, data: { lastUsedAt: new Date() } }) : null,
      )
      .catch((err: unknown) => logger.warn({ err }, 'could not record API key use'));

    req.apiKey = ctx;
    next();
  };
}
