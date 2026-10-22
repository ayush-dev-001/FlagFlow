import type { Snapshot } from '@flagflow/shared';
import type { PrismaClient } from '../db.js';
import { snapshotKey } from '../flags/events.js';
import type { Logger } from '../logger.js';
import type { Redis } from '../redis.js';

const SNAPSHOT_TTL_SECONDS = 3600;

/** Cache-aside access to an org's flag snapshot (ARCHITECTURE §3.2). Redis is a cache; Postgres is the truth. */
export function snapshotStore(prisma: PrismaClient, redis: Redis, logger: Logger) {
  /** Version and flags read in one REPEATABLE READ transaction, so they always belong together. */
  async function load(orgId: string): Promise<Snapshot> {
    return prisma.$transaction(
      async (tx) => {
        const org = await tx.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { flagsVersion: true },
        });
        const flags = await tx.flag.findMany({
          where: { orgId },
          orderBy: { key: 'asc' },
          select: { key: true, enabled: true, targetAll: true, targets: { select: { endUserId: true } } },
        });
        return {
          version: org.flagsVersion,
          flags: flags.map((f) => ({
            key: f.key,
            enabled: f.enabled,
            targetAll: f.targetAll,
            targets: f.targets.map((t) => t.endUserId),
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async function currentVersion(orgId: string) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { flagsVersion: true },
    });
    return org.flagsVersion;
  }

  return {
    load,

    async get(orgId: string): Promise<Snapshot> {
      try {
        const cached = await redis.get(snapshotKey(orgId));
        if (cached) return JSON.parse(cached) as Snapshot;
      } catch (err) {
        logger.warn({ err, orgId }, 'snapshot cache unavailable, reading Postgres');
        return load(orgId);
      }

      const snapshot = await load(orgId);
      try {
        await redis.set(snapshotKey(orgId), JSON.stringify(snapshot), 'EX', SNAPSHOT_TTL_SECONDS);
        // A change may have committed (and deleted the key) between our read and our write; if so,
        // drop what we just cached rather than serve it for an hour.
        if ((await currentVersion(orgId)) !== snapshot.version) {
          await redis.del(snapshotKey(orgId));
          return load(orgId);
        }
      } catch (err) {
        logger.warn({ err, orgId }, 'could not cache snapshot');
      }
      return snapshot;
    },
  };
}

export type SnapshotStore = ReturnType<typeof snapshotStore>;
