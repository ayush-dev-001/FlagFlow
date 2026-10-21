import { Router } from 'express';
import type { PrismaClient } from './db.js';
import type { Redis } from './redis.js';

const CHECK_TIMEOUT_MS = 2000;

async function probe(check: () => Promise<unknown>): Promise<'ok' | 'error'> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

export function healthRouter(prisma: PrismaClient, redis: Redis): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    const [postgres, redisStatus] = await Promise.all([
      probe(() => prisma.$queryRaw`SELECT 1`),
      probe(() => redis.ping()),
    ]);
    const healthy = postgres === 'ok' && redisStatus === 'ok';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      checks: { postgres, redis: redisStatus },
    });
  });
  return router;
}
