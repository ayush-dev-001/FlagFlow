import { pino } from 'pino';
import type { AppDeps } from '../app.js';
import { createPrisma, type PrismaClient } from '../db.js';
import { createRedis, type Redis } from '../redis.js';

// Tests use the docker test database and Redis DB 1 (PLAN.md §7), never the dev data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://flagflow:flagflow@localhost:5432/flagflow_test';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';
export const DASHBOARD_ORIGIN = 'http://localhost:5173';

export const silentLogger = pino({ level: 'silent' });

export function connectTestDb(): PrismaClient {
  return createPrisma(TEST_DATABASE_URL);
}

export function connectTestRedis(): Redis {
  return createRedis(TEST_REDIS_URL);
}

/** A Redis client pointed at a closed port that fails every command at once. */
export function deadRedis(): Redis {
  const redis = createRedis('redis://127.0.0.1:6390', {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  return redis;
}

export const TEST_JWT_SECRET = 'test-secret-'.padEnd(64, 'x');

export function testDeps(prisma: PrismaClient, redis: Redis, env: Partial<AppDeps['env']> = {}): AppDeps {
  return {
    env: {
      DASHBOARD_ORIGIN,
      JWT_ACCESS_SECRET: TEST_JWT_SECRET,
      REFRESH_TOKEN_TTL_DAYS: 7,
      TRUST_PROXY: 0,
      ...env,
    },
    logger: silentLogger,
    prisma,
    redis,
  };
}

/** Empties test Redis (DB 1) so rate-limit counters and sessions don't leak between tests. */
export async function resetRedis(redis: Redis): Promise<void> {
  if (redis.options.db !== 1) throw new Error(`Refusing to flush Redis DB ${redis.options.db}`);
  await redis.flushdb();
}

/** Empties every table. Refuses to run against anything but a *_test database. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const [row] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (!row?.db.endsWith('_test')) throw new Error(`Refusing to reset non-test database "${row?.db}"`);
  await prisma.$executeRawUnsafe(
    'TRUNCATE organization, "user", api_key, flag, flag_target, invite, session, audit_log RESTART IDENTITY CASCADE',
  );
}
