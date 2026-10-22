import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { AppError } from './errors.js';
import type { Redis } from './redis.js';

const MINUTE = 60_000;

// req.ip honours `trust proxy` only; with TRUST_PROXY=0 a forged X-Forwarded-For changes nothing.
const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

const bodyEmail = (req: Request): string => {
  const body: unknown = req.body;
  if (typeof body !== 'object' || body === null || !('email' in body) || typeof body.email !== 'string')
    return '';
  return body.email.trim().toLowerCase().slice(0, 254);
};

/**
 * Redis-backed limiters (ARCHITECTURE §5), so limits hold across every API instance.
 * `scale` multiplies every limit; it is 1 everywhere except the local ZAP scan (see env.ts).
 */
export function createLimiters(redis: Redis, scale = 1) {
  const limiter = (name: string, limit: number, keyGenerator: (req: Request) => string) =>
    rateLimit({
      windowMs: MINUTE,
      limit: limit * scale,
      keyGenerator,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      // Fail closed: if Redis is down, limited routes refuse rather than run unlimited.
      passOnStoreError: false,
      store: new RedisStore({
        prefix: `ff:rl:${name}:`,
        sendCommand: (command: string, ...args: string[]) =>
          redis.call(command, ...args) as Promise<RedisReply>,
      }),
      handler: ((_req, _res, next) => {
        next(new AppError(429, 'RATE_LIMITED', 'Too many requests, try again later'));
      }) satisfies Options['handler'],
    });

  return {
    /** 5 per minute per IP + email: slows guessing one account's password. */
    login: limiter('login', 5, (req) => `${ipKey(req)}:${bodyEmail(req)}`),
    /** 20 per minute per IP: slows spraying many accounts from one address. */
    loginPerIp: limiter('login-ip', 20, ipKey),
    /** Other unauthenticated auth endpoints (register, refresh). */
    publicAuth: limiter('auth', 20, ipKey),
    /** 300 per minute per user on authenticated routes. */
    api: limiter('api', 300, (req) => req.auth?.userId ?? ipKey(req)),
  };
}

export type Limiters = ReturnType<typeof createLimiters>;
