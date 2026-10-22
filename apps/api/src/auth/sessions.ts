import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import type { Logger } from '../logger.js';
import type { Redis } from '../redis.js';
import { newRefreshToken, parseRefreshToken } from './tokens.js';

export const sessionKey = (sid: string) => `ff:session:${sid}`;
export const denyKey = (jti: string) => `ff:deny:${jti}`;

const invalidRefresh = () =>
  new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired, please log in again');
const secondsUntil = (date: Date) => Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));

export interface SessionDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
  ttlDays: number;
}

export function sessions({ prisma, redis, logger, ttlDays }: SessionDeps) {
  async function revoke(sid: string) {
    await prisma.session.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } });
    await redis.del(sessionKey(sid));
  }

  return {
    /** Starts a session. Its lifetime is fixed at login: refreshing rotates the token but never extends it. */
    async create(userId: string) {
      const sid = randomUUID();
      const { token, hash } = newRefreshToken(sid);
      const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
      await prisma.session.create({ data: { id: sid, userId, refreshTokenHash: hash, expiresAt } });
      await redis.set(sessionKey(sid), userId, 'EX', secondsUntil(expiresAt));
      return { sid, refreshToken: token, expiresAt };
    },

    /**
     * Swaps a refresh token for a new one. The swap is a single conditional UPDATE, so of two concurrent
     * uses only one can win. A token that matches a live session but not its current hash has already
     * been used: that is treated as theft and the whole session is revoked.
     */
    async rotate(refreshToken: string) {
      const parsed = parseRefreshToken(refreshToken);
      if (!parsed) throw invalidRefresh();
      const next = newRefreshToken(parsed.sid);

      const { count } = await prisma.session.updateMany({
        where: {
          id: parsed.sid,
          refreshTokenHash: parsed.hash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { refreshTokenHash: next.hash },
      });

      if (count === 0) {
        const existing = await prisma.session.findUnique({ where: { id: parsed.sid } });
        if (existing && !existing.revokedAt && existing.refreshTokenHash !== parsed.hash) {
          logger.warn(
            { sid: parsed.sid, userId: existing.userId },
            'refresh token reuse detected, session revoked',
          );
          await revoke(parsed.sid);
        }
        throw invalidRefresh();
      }

      const session = await prisma.session.findUniqueOrThrow({
        where: { id: parsed.sid },
        include: { user: { include: { org: true } } },
      });
      const { user } = session;
      if (!user.isActive || (user.org && !user.org.isActive)) {
        await revoke(session.id);
        throw invalidRefresh();
      }
      await redis.set(sessionKey(session.id), user.id, 'EX', secondsUntil(session.expiresAt));
      return { sid: session.id, user, refreshToken: next.token, expiresAt: session.expiresAt };
    },

    revoke,

    /** Blocks an access token for the rest of its lifetime. */
    async denylist(jti: string, exp: number) {
      const ttl = exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await redis.set(denyKey(jti), '1', 'EX', ttl);
    },
  };
}

export type Sessions = ReturnType<typeof sessions>;
