import { evaluate } from '@flagflow/shared';
import { type Request, Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { orgOf, parseId } from '../http.js';
import type { Limiters } from '../rateLimit.js';
import type { Redis } from '../redis.js';
import {
  auditQuery,
  createFlagBody,
  endUserId as endUserIdSchema,
  listFlagsQuery,
  targetsBody,
  updateFlagBody,
} from './schemas.js';
import { type Actor, flagInclude, type FlagService, type FlagWithTargets } from './service.js';

export interface FlagRouteDeps {
  prisma: PrismaClient;
  redis: Redis;
  limiters: Limiters;
  flags: FlagService;
  jwtSecret: string;
  /** Open SDK streams for an org (the flag page's "connected" indicator). */
  connectedClients: (orgId: string) => Promise<number>;
}

type FlagSummaryRow = Omit<FlagWithTargets, 'targets'> & { _count?: { targets: number }; targets?: unknown };

/** The board column (ARCHITECTURE §4): worked out, not stored. */
const stateOf = (f: { enabled: boolean; targetAll: boolean }) =>
  !f.enabled ? 'inactive' : f.targetAll ? 'live' : 'testing';

const toSummary = (f: FlagSummaryRow, targetCount: number) => ({
  id: f.id,
  key: f.key,
  description: f.description,
  enabled: f.enabled,
  targetAll: f.targetAll,
  state: stateOf(f),
  version: f.version,
  targetCount,
  createdBy: f.createdBy,
  updatedBy: f.updatedBy,
  createdAt: f.createdAt.toISOString(),
  updatedAt: f.updatedAt.toISOString(),
});

const toDetail = (f: FlagWithTargets) => ({
  ...toSummary(f, f.targets.length),
  targets: f.targets.map((t) => t.endUserId),
});

const actorOf = (req: Request): Actor => ({ orgId: orgOf(req), userId: req.auth!.userId, ip: req.ip });

/** Escapes LIKE wildcards so a search for "%" or "_" matches those characters, not everything. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const STATE_FILTER = {
  inactive: { enabled: false },
  testing: { enabled: true, targetAll: false },
  live: { enabled: true, targetAll: true },
} satisfies Record<string, Prisma.FlagWhereInput>;

export function flagRoutes({ prisma, redis, limiters, flags, jwtSecret, connectedClients }: FlagRouteDeps) {
  const member = [requireAuth(jwtSecret, redis), limiters.api, requireRole('ADMIN', 'MEMBER')];
  const adminOnly = requireRole('ADMIN');

  const flagsRouter = Router();
  flagsRouter.use(...member);

  flagsRouter.get('/', async (req, res) => {
    const { search, state } = listFlagsQuery.parse(req.query);
    const where: Prisma.FlagWhereInput = { orgId: orgOf(req), ...(state && STATE_FILTER[state]) };
    if (search) {
      const term = literal(search);
      where.OR = [
        { key: { contains: term.toLowerCase() } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.flag.findMany({
      where,
      orderBy: { key: 'asc' },
      take: 500,
      include: {
        _count: { select: { targets: true } },
        createdBy: flagInclude.createdBy,
        updatedBy: flagInclude.updatedBy,
      },
    });
    res.json({ flags: rows.map((f) => toSummary(f, f._count.targets)) });
  });

  flagsRouter.post('/', async (req, res) => {
    const flag = await flags.create(actorOf(req), createFlagBody.parse(req.body));
    res.status(201).json({ flag: toDetail(flag) });
  });

  // Before /:id, so the word isn't read as a flag id.
  flagsRouter.get('/connections', async (req, res) => {
    res.json({ connectedClients: await connectedClients(orgOf(req)) });
  });

  flagsRouter.get('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'Flag');
    const flag = await prisma.flag.findFirst({ where: { id, orgId: orgOf(req) }, include: flagInclude });
    if (!flag) throw new AppError(404, 'NOT_FOUND', 'Flag not found');
    res.json({ flag: toDetail(flag) });
  });

  flagsRouter.patch('/:id', async (req, res) => {
    const id = parseId(req.params.id, 'Flag');
    const flag = await flags.update(actorOf(req), id, updateFlagBody.parse(req.body));
    res.json({ flag: toDetail(flag) });
  });

  flagsRouter.post('/:id/toggle', async (req, res) => {
    const id = parseId(req.params.id, 'Flag');
    res.json({ flag: toDetail(await flags.toggle(actorOf(req), id)) });
  });

  flagsRouter.post('/:id/targets', async (req, res) => {
    const id = parseId(req.params.id, 'Flag');
    const flag = await flags.changeTargets(actorOf(req), id, targetsBody.parse(req.body));
    res.json({ flag: toDetail(flag) });
  });

  flagsRouter.delete('/:id', adminOnly, async (req, res) => {
    await flags.remove(actorOf(req), parseId(req.params.id, 'Flag'));
    res.status(204).end();
  });

  const endUsersRouter = Router();
  endUsersRouter.use(...member);

  endUsersRouter.get('/:endUserId/flags', async (req, res) => {
    const parsed = endUserIdSchema.safeParse(req.params.endUserId);
    if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid end-user id');
    const userId = parsed.data;
    const rows = await prisma.flag.findMany({
      where: { orgId: orgOf(req) },
      orderBy: { key: 'asc' },
      include: { targets: { where: { endUserId: userId }, select: { endUserId: true } } },
    });
    res.json({
      endUserId: userId,
      flags: rows.map((f) => {
        const targeted = f.targets.length > 0;
        return {
          id: f.id,
          key: f.key,
          description: f.description,
          enabled: evaluate(
            { key: f.key, enabled: f.enabled, targetAll: f.targetAll, targets: targeted ? [userId] : [] },
            userId,
          ),
          targeted,
          flagEnabled: f.enabled,
          targetAll: f.targetAll,
        };
      }),
    });
  });

  const auditRouter = Router();
  auditRouter.use(...member, adminOnly);

  auditRouter.get('/', async (req, res) => {
    const q = auditQuery.parse(req.query);
    const rows = await prisma.auditLog.findMany({
      where: {
        orgId: orgOf(req),
        ...(q.flagId && { flagId: q.flagId }),
        ...(q.actorId && { actorId: q.actorId }),
        ...(q.cursor && { id: { lt: BigInt(q.cursor) } }),
      },
      orderBy: { id: 'desc' },
      take: q.limit + 1,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    const page = rows.slice(0, q.limit);
    res.json({
      entries: page.map((a) => ({
        id: a.id.toString(),
        action: a.action,
        flagId: a.flagId,
        actor: a.actor,
        metadata: a.metadata,
        ip: a.ip,
        createdAt: a.createdAt.toISOString(),
      })),
      nextCursor: rows.length > q.limit ? page.at(-1)!.id.toString() : null,
    });
  });

  return { flagsRouter, endUsersRouter, auditRouter };
}
