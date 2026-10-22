import type { FlagRule } from '@flagflow/shared';
import type { z } from 'zod';
import { audit } from '../audit.js';
import type { PrismaClient } from '../db.js';
import { AppError } from '../errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { notFound } from '../http.js';
import type { Logger } from '../logger.js';
import type { Redis } from '../redis.js';
import { publishFlagEvent } from './events.js';
import {
  type createFlagBody,
  MAX_TARGETS_PER_FLAG,
  type targetsBody,
  type updateFlagBody,
} from './schemas.js';

/** Who is making a change, for the audit row. */
export interface Actor {
  orgId: string;
  userId: string;
  ip: string | undefined;
}

type Tx = Prisma.TransactionClient;

export const flagInclude = {
  targets: { select: { endUserId: true }, orderBy: { endUserId: 'asc' } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
} satisfies Prisma.FlagInclude;

export type FlagWithTargets = Prisma.FlagGetPayload<{ include: typeof flagInclude }>;

export const ruleOf = (f: FlagWithTargets): FlagRule => ({
  key: f.key,
  enabled: f.enabled,
  targetAll: f.targetAll,
  targets: f.targets.map((t) => t.endUserId),
});

/** Every flag change goes through here: one transaction with its audit row, then invalidate + publish. */
export function flagService(prisma: PrismaClient, redis: Redis, logger: Logger) {
  /** Increments the org's flags version inside the change's transaction and returns the new value. */
  async function bumpVersion(tx: Tx, orgId: string) {
    const org = await tx.organization.update({
      where: { id: orgId },
      data: { flagsVersion: { increment: 1 } },
      select: { flagsVersion: true },
    });
    return org.flagsVersion;
  }

  /** Row-locks the flag for the rest of the transaction, so concurrent changes to it run one after another. */
  async function lockFlag(tx: Tx, orgId: string, id: string): Promise<FlagWithTargets> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM flag WHERE id = ${id}::uuid AND org_id = ${orgId}::uuid FOR UPDATE`;
    if (rows.length === 0) throw notFound('Flag');
    return tx.flag.findUniqueOrThrow({ where: { id }, include: flagInclude });
  }

  async function updated(actor: Actor, flag: FlagWithTargets, version: number) {
    await publishFlagEvent(redis, logger, actor.orgId, { type: 'flag.updated', version, flag: ruleOf(flag) });
    return flag;
  }

  return {
    async create(actor: Actor, body: z.infer<typeof createFlagBody>) {
      let result;
      try {
        result = await prisma.$transaction(async (tx) => {
          const version = await bumpVersion(tx, actor.orgId);
          const flag = await tx.flag.create({
            data: {
              orgId: actor.orgId,
              key: body.key,
              description: body.description,
              targetAll: body.targetAll,
              version,
              createdById: actor.userId,
              updatedById: actor.userId,
              targets: {
                createMany: { data: body.targets.map((endUserId) => ({ endUserId, orgId: actor.orgId })) },
              },
            },
            include: flagInclude,
          });
          await audit(tx, {
            orgId: actor.orgId,
            actorId: actor.userId,
            ip: actor.ip,
            flagId: flag.id,
            action: 'FLAG_CREATED',
            metadata: { after: { ...ruleOf(flag), description: flag.description } },
          });
          return { flag, version };
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError(409, 'FLAG_KEY_TAKEN', `A flag with key "${body.key}" already exists`);
        }
        throw err;
      }
      return updated(actor, result.flag, result.version);
    },

    async update(actor: Actor, id: string, body: z.infer<typeof updateFlagBody>) {
      const { flag, version } = await prisma.$transaction(async (tx) => {
        const before = await lockFlag(tx, actor.orgId, id);
        const version = await bumpVersion(tx, actor.orgId);
        const flag = await tx.flag.update({
          where: { id },
          data: { ...body, version, updatedById: actor.userId },
          include: flagInclude,
        });
        const pick = (f: FlagWithTargets) =>
          Object.fromEntries(Object.keys(body).map((k) => [k, f[k as keyof typeof body]]));
        await audit(tx, {
          orgId: actor.orgId,
          actorId: actor.userId,
          ip: actor.ip,
          flagId: id,
          action: 'FLAG_UPDATED',
          metadata: { before: pick(before), after: pick(flag) },
        });
        return { flag, version };
      });
      return updated(actor, flag, version);
    },

    async toggle(actor: Actor, id: string) {
      const { flag, version } = await prisma.$transaction(async (tx) => {
        const before = await lockFlag(tx, actor.orgId, id);
        const version = await bumpVersion(tx, actor.orgId);
        const flag = await tx.flag.update({
          where: { id },
          data: { enabled: !before.enabled, version, updatedById: actor.userId },
          include: flagInclude,
        });
        await audit(tx, {
          orgId: actor.orgId,
          actorId: actor.userId,
          ip: actor.ip,
          flagId: id,
          action: 'FLAG_TOGGLED',
          metadata: { before: { enabled: before.enabled }, after: { enabled: flag.enabled } },
        });
        return { flag, version };
      });
      return updated(actor, flag, version);
    },

    async changeTargets(actor: Actor, id: string, body: z.infer<typeof targetsBody>) {
      const result = await prisma.$transaction(async (tx) => {
        const before = await lockFlag(tx, actor.orgId, id);
        const current = new Set(before.targets.map((t) => t.endUserId));
        const added = body.add.filter((u) => !current.has(u));
        const removed = body.remove.filter((u) => current.has(u));
        // Adding what's there or removing what isn't changes nothing: no version bump, no audit row.
        if (added.length === 0 && removed.length === 0) return { flag: before, version: null };
        if (current.size + added.length - removed.length > MAX_TARGETS_PER_FLAG) {
          throw new AppError(
            400,
            'TOO_MANY_TARGETS',
            `A flag can target at most ${MAX_TARGETS_PER_FLAG} users`,
          );
        }

        if (removed.length > 0)
          await tx.flagTarget.deleteMany({ where: { flagId: id, endUserId: { in: removed } } });
        if (added.length > 0) {
          await tx.flagTarget.createMany({
            data: added.map((endUserId) => ({ flagId: id, endUserId, orgId: actor.orgId })),
          });
        }
        const version = await bumpVersion(tx, actor.orgId);
        const flag = await tx.flag.update({
          where: { id },
          data: { version, updatedById: actor.userId },
          include: flagInclude,
        });
        await audit(tx, {
          orgId: actor.orgId,
          actorId: actor.userId,
          ip: actor.ip,
          flagId: id,
          action: 'FLAG_TARGETS_CHANGED',
          metadata: { added, removed },
        });
        return { flag, version };
      });
      return result.version === null ? result.flag : updated(actor, result.flag, result.version);
    },

    async remove(actor: Actor, id: string) {
      const { key, version } = await prisma.$transaction(async (tx) => {
        const before = await lockFlag(tx, actor.orgId, id);
        const version = await bumpVersion(tx, actor.orgId);
        await tx.flag.delete({ where: { id } });
        await audit(tx, {
          orgId: actor.orgId,
          actorId: actor.userId,
          ip: actor.ip,
          flagId: id,
          action: 'FLAG_DELETED',
          metadata: { before: { ...ruleOf(before), description: before.description } },
        });
        return { key: before.key, version };
      });
      await publishFlagEvent(redis, logger, actor.orgId, { type: 'flag.deleted', version, key });
    },
  };
}

export type FlagService = ReturnType<typeof flagService>;
