import type { FlagEvent } from '@flagflow/shared';
import type { Logger } from '../logger.js';
import type { Redis } from '../redis.js';

// Redis keys from ARCHITECTURE §5.
export const snapshotKey = (orgId: string) => `ff:org:${orgId}:snapshot`;
export const eventsChannel = (orgId: string) => `ff:events:${orgId}`;
export const EVENTS_PATTERN = 'ff:events:*';
export type { FlagEvent };

const RETRY_DELAYS_MS = [50, 200, 1000];

/**
 * Runs after the change has committed: drops the org's cached snapshot, then tells every API instance.
 * Postgres already holds the change, so Redis failures are retried and then logged rather than failing
 * the request. If every retry fails, a cached snapshot can stay stale until its 1-hour TTL; while Redis is
 * down, reads skip the cache and go to Postgres anyway.
 */
export async function publishFlagEvent(redis: Redis, logger: Logger, orgId: string, event: FlagEvent) {
  for (let attempt = 0; ; attempt++) {
    try {
      await redis.del(snapshotKey(orgId));
      await redis.publish(eventsChannel(orgId), JSON.stringify(event));
      return;
    } catch (err) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) {
        logger.error(
          { err, orgId, event: event.type },
          'flag change committed but snapshot invalidation/publish failed',
        );
        return;
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
