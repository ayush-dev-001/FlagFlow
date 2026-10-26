import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { Sessions } from '../auth/sessions.js';
import type { PrismaClient } from '../db.js';
import { notFound, parseId } from '../http.js';
import { apiKeyCacheKey, KEY_REVOKED_CHANNEL } from '../public/apiKeyAuth.js';
import type { Limiters } from '../rateLimit.js';
import type { Redis } from '../redis.js';

export interface AdminDeps {
  prisma: PrismaClient;
  redis: Redis;
  sessions: Sessions;
  limiters: Limiters;
  jwtSecret: string;
}

export const updateOrgStatusBody = z.object({ isActive: z.boolean() });

export const organizationSummary = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
  members: z.number().int(),
  flags: z.number().int(),
  activeApiKeys: z.number().int(),
  createdAt: z.iso.datetime(),
});

const summaryInclude = {
  _count: {
    select: { users: true, flags: true, apiKeys: { where: { revokedAt: null } } },
  },
} as const;

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  _count: { users: number; flags: number; apiKeys: number };
};

const toSummary = (o: OrgRow) => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
  isActive: o.isActive,
  members: o._count.users,
  flags: o._count.flags,
  activeApiKeys: o._count.apiKeys,
  createdAt: o.createdAt.toISOString(),
});

/** Platform administration: superadmins only. Superadmins have no org, so nothing here is org-scoped. */
export function adminRouter({ prisma, redis, sessions, limiters, jwtSecret }: AdminDeps) {
  const router = Router();
  router.use(requireAuth(jwtSecret, redis), limiters.api, requireRole('SUPERADMIN'));

  router.get('/organizations', async (_req, res) => {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      take: 1000,
      include: summaryInclude,
    });
    res.json({ organizations: orgs.map(toSummary) });
  });

  router.patch('/organizations/:id', async (req, res) => {
    const id = parseId(req.params.id, 'Organization');
    const { isActive } = updateOrgStatusBody.parse(req.body);

    const { before, after } = await prisma.$transaction(async (tx) => {
      const before = await tx.organization.findUnique({ where: { id } });
      if (!before) throw notFound('Organization');
      const after = await tx.organization.update({
        where: { id },
        data: { isActive },
        include: summaryInclude,
      });
      if (before.isActive !== isActive) {
        await audit(tx, {
          orgId: id,
          actorId: req.auth!.userId,
          ip: req.ip,
          action: 'ORG_STATUS_CHANGED',
          metadata: { before: { isActive: before.isActive }, after: { isActive } },
        });
      }
      return { before, after };
    });

    // Deactivating cuts the org off at once: its people's sessions end, and every open SDK stream closes.
    // Login, refresh and API-key checks already refuse an inactive org from here on.
    if (before.isActive && !isActive) {
      const users = await prisma.user.findMany({ where: { orgId: id }, select: { id: true } });
      for (const u of users) await sessions.revokeAllForUser(u.id);
      const keys = await prisma.apiKey.findMany({
        where: { orgId: id, revokedAt: null },
        select: { id: true, keyHash: true },
      });
      if (keys.length > 0) await redis.del(...keys.map((k) => apiKeyCacheKey(k.keyHash)));
      for (const k of keys) await redis.publish(KEY_REVOKED_CHANNEL, k.id);
    }
    res.json({ organization: toSummary(after) });
  });

  return router;
}
