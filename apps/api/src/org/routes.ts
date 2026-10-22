import { Router } from 'express';
import { z } from 'zod';
import { generateApiKey } from '../apiKeys.js';
import { audit } from '../audit.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import type { ApiKey } from '../generated/prisma/client.js';
import { notFound, orgOf, parseId } from '../http.js';
import { apiKeyCacheKey, KEY_REVOKED_CHANNEL } from '../public/apiKeyAuth.js';
import type { Limiters } from '../rateLimit.js';
import type { Redis } from '../redis.js';

export interface OrgDeps {
  prisma: PrismaClient;
  redis: Redis;
  limiters: Limiters;
  jwtSecret: string;
}

export const updateOrgBody = z.object({ name: z.string().trim().min(2).max(100) });
export const createApiKeyBody = z.object({ name: z.string().trim().min(1).max(60) });
export const MAX_ACTIVE_KEYS = 10;

export const apiKeySummary = z.object({
  id: z.uuid(),
  name: z.string(),
  prefix: z.string(),
  lastUsedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

const toKey = (k: ApiKey) => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  revokedAt: k.revokedAt?.toISOString() ?? null,
  createdAt: k.createdAt.toISOString(),
});

export function orgRouter({ prisma, redis, limiters, jwtSecret }: OrgDeps): Router {
  const router = Router();
  router.use(requireAuth(jwtSecret, redis), limiters.api, requireRole('ADMIN'));

  router.get('/', async (req, res) => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgOf(req) } });
    res.json({ organization: { id: org.id, name: org.name, slug: org.slug } });
  });

  router.patch('/', async (req, res) => {
    const orgId = orgOf(req);
    const { name } = updateOrgBody.parse(req.body);
    const org = await prisma.$transaction(async (tx) => {
      const before = await tx.organization.findUniqueOrThrow({ where: { id: orgId } });
      const after = await tx.organization.update({ where: { id: orgId }, data: { name } });
      await audit(tx, {
        orgId,
        actorId: req.auth!.userId,
        ip: req.ip,
        action: 'ORG_UPDATED',
        metadata: { before: { name: before.name }, after: { name } },
      });
      return after;
    });
    res.json({ organization: { id: org.id, name: org.name, slug: org.slug } });
  });

  router.get('/api-keys', async (req, res) => {
    const keys = await prisma.apiKey.findMany({
      where: { orgId: orgOf(req) },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ apiKeys: keys.map(toKey) });
  });

  router.post('/api-keys', async (req, res) => {
    const orgId = orgOf(req);
    const { name } = createApiKeyBody.parse(req.body);
    const generated = generateApiKey();
    const key = await prisma.$transaction(async (tx) => {
      // Several keys allow rotation without downtime; a cap stops unbounded key sprawl.
      const active = await tx.apiKey.count({ where: { orgId, revokedAt: null } });
      if (active >= MAX_ACTIVE_KEYS) {
        throw new AppError(
          409,
          'TOO_MANY_KEYS',
          `Revoke a key first: at most ${MAX_ACTIVE_KEYS} active keys`,
        );
      }
      const key = await tx.apiKey.create({
        data: { orgId, name, prefix: generated.prefix, keyHash: generated.hash },
      });
      await audit(tx, {
        orgId,
        actorId: req.auth!.userId,
        ip: req.ip,
        action: 'API_KEY_CREATED',
        metadata: { after: { id: key.id, name, prefix: key.prefix } },
      });
      return key;
    });
    res.status(201).json({ apiKey: { ...toKey(key), key: generated.key } });
  });

  router.delete('/api-keys/:id', async (req, res) => {
    const orgId = orgOf(req);
    const id = parseId(req.params.id, 'API key');
    const key = await prisma.$transaction(async (tx) => {
      const key = await tx.apiKey.findFirst({ where: { id, orgId, revokedAt: null } });
      if (!key) throw notFound('Active API key');
      await tx.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
      await audit(tx, {
        orgId,
        actorId: req.auth!.userId,
        ip: req.ip,
        action: 'API_KEY_REVOKED',
        metadata: { before: { id, name: key.name, prefix: key.prefix } },
      });
      return key;
    });
    // Drop the cached lookup so the very next request with this key fails, and close its open streams.
    await redis.del(apiKeyCacheKey(key.keyHash));
    await redis.publish(KEY_REVOKED_CHANNEL, key.id);
    res.status(204).end();
  });

  return router;
}
