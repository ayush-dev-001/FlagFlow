import { evaluate, evaluateAll } from '@flagflow/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import { endUserId, flagKey } from '../flags/schemas.js';
import type { Logger } from '../logger.js';
import type { Limiters } from '../rateLimit.js';
import type { Redis } from '../redis.js';
import { requireApiKey } from './apiKeyAuth.js';
import type { SnapshotStore } from './snapshots.js';
import type { StreamHub } from './stream.js';

export interface PublicDeps {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
  limiters: Limiters;
  snapshots: SnapshotStore;
  streams: StreamHub;
}

export const evaluateQuery = z.object({ userId: endUserId });

/** `/v1`: server-to-server, API key only, no cookies and no CORS (ARCHITECTURE §9). */
export function publicRouter({ prisma, redis, logger, limiters, snapshots, streams }: PublicDeps): Router {
  const router = Router();
  // Responses are per-org but the key travels in x-api-key, not Authorization, so shared caches would
  // otherwise be allowed to store one org's answer and replay it to another. Never cache /v1.
  router.use((_req, res, next) => {
    res.set({ 'cache-control': 'no-store', vary: 'x-api-key' });
    next();
  });
  router.use(limiters.publicApiFailures, requireApiKey(prisma, redis, logger), limiters.publicApi);

  /** Records lastEvaluatedAt at most once a minute per org (and per flag), off the request path. */
  function markEvaluated(orgId: string, key?: string) {
    const marker = `ff:evaluated:${orgId}:${key ?? '*'}`;
    void redis
      .set(marker, '1', 'EX', 60, 'NX')
      .then((fresh) =>
        fresh
          ? prisma.flag.updateMany({
              where: { orgId, ...(key && { key }) },
              data: { lastEvaluatedAt: new Date() },
            })
          : null,
      )
      .catch((err: unknown) => logger.warn({ err }, 'could not record flag evaluation'));
  }

  router.get('/flags/evaluate', async (req, res) => {
    const { userId } = evaluateQuery.parse(req.query);
    const orgId = req.apiKey!.orgId;
    const snapshot = await snapshots.get(orgId);
    markEvaluated(orgId);
    res.json({ version: snapshot.version, flags: evaluateAll(snapshot, userId) });
  });

  router.get('/flags/:key/evaluate', async (req, res) => {
    const key = flagKey.safeParse(req.params.key);
    if (!key.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid flag key');
    const { userId } = evaluateQuery.parse(req.query);
    const orgId = req.apiKey!.orgId;
    const snapshot = await snapshots.get(orgId);
    markEvaluated(orgId, key.data);
    // An unknown flag is simply off (PLAN.md §1), so callers can ship code before the flag exists.
    res.json({
      version: snapshot.version,
      enabled: evaluate(
        snapshot.flags.find((f) => f.key === key.data),
        userId,
      ),
    });
  });

  router.get('/snapshot', async (req, res) => {
    res.json(await snapshots.get(req.apiKey!.orgId));
  });

  router.get('/stream', async (req, res) => {
    await streams.handle(req, res);
  });

  return router;
}
