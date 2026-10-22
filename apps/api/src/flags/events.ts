import type { FlagRule } from '@flagflow/shared';
import type { Logger } from '../logger.js';
import type { Redis } from '../redis.js';

// Redis keys from ARCHITECTURE §5.
export const snapshotKey = (orgId: string) => `ff:org:${orgId}:snapshot`;
export const eventsChannel = (orgId: string) => `ff:events:${orgId}`;

export type FlagEvent =
  | { type: 'flag.updated'; version: number; flag: FlagRule }
  | { type: 'flag.deleted'; version: number; key: string };

/**
 * Runs after the change has committed: drops the org's cached snapshot, then tells every API instance.
 * Postgres already holds the change, so a Redis failure here is logged rather than failing the request.
 */
export async function publishFlagEvent(redis: Redis, logger: Logger, orgId: string, event: FlagEvent) {
  try {
    await redis.del(snapshotKey(orgId));
    await redis.publish(eventsChannel(orgId), JSON.stringify(event));
  } catch (err) {
    logger.error(
      { err, orgId, event: event.type },
      'flag change committed but snapshot invalidation/publish failed',
    );
  }
}
