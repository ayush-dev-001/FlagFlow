import { randomUUID } from 'node:crypto';
import type { FlagEvent } from '@flagflow/shared';
import type { Request, Response } from 'express';
import { AppError } from '../errors.js';
import { EVENTS_PATTERN } from '../flags/events.js';
import type { Logger } from '../logger.js';
import type { Redis } from '../redis.js';
import { KEY_REVOKED_CHANNEL } from './apiKeyAuth.js';
import type { SnapshotStore } from './snapshots.js';

export interface StreamOptions {
  heartbeatMs?: number;
  maxStreamsPerKey?: number;
}

interface Connection {
  orgId: string;
  keyId: string;
  /** Events that arrived before the opening snapshot was sent; null once live. */
  pending: FlagEvent[] | null;
  lastVersion: number;
  send(event: string, data: unknown, id?: number): void;
  end(reason?: { code: string; message: string }): void;
}

const streamSlotsKey = (keyId: string) => `ff:sse:${keyId}`;

/**
 * GET /v1/stream. One Redis subscriber per process (PSUBSCRIBE ff:events:*) fans each event out to the
 * open streams of that event's org only. Open streams per key are tracked in Redis, so the cap holds
 * across instances; entries refresh on each heartbeat, so a crashed instance's slots expire.
 */
export class StreamHub {
  private readonly byOrg = new Map<string, Set<Connection>>();
  private readonly byKey = new Map<string, Set<Connection>>();
  private subscriber: Promise<Redis> | null = null;
  private readonly heartbeatMs: number;
  private readonly maxPerKey: number;

  constructor(
    private readonly redis: Redis,
    private readonly snapshots: SnapshotStore,
    private readonly logger: Logger,
    options: StreamOptions = {},
  ) {
    this.heartbeatMs = options.heartbeatMs ?? 25_000;
    this.maxPerKey = options.maxStreamsPerKey ?? 20;
  }

  private subscribe(): Promise<Redis> {
    this.subscriber ??= (async () => {
      const sub = this.redis.duplicate();
      sub.on('error', (err) => this.logger.warn({ err }, 'stream subscriber error'));
      sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
        const orgId = channel.slice('ff:events:'.length);
        const conns = this.byOrg.get(orgId);
        if (!conns) return;
        const event = JSON.parse(message) as FlagEvent;
        for (const conn of conns) this.deliver(conn, event);
      });
      sub.on('message', (channel: string, keyId: string) => {
        if (channel !== KEY_REVOKED_CHANNEL) return;
        for (const conn of [...(this.byKey.get(keyId) ?? [])]) {
          conn.end({ code: 'API_KEY_REVOKED', message: 'This API key was revoked' });
        }
      });
      await sub.psubscribe(EVENTS_PATTERN);
      await sub.subscribe(KEY_REVOKED_CHANNEL);
      return sub;
    })();
    return this.subscriber;
  }

  private deliver(conn: Connection, event: FlagEvent) {
    if (conn.pending) {
      conn.pending.push(event);
      return;
    }
    // Versions only go up; anything at or below what the client has is a duplicate.
    if (event.version <= conn.lastVersion) return;
    conn.lastVersion = event.version;
    conn.send(event.type, event, event.version);
  }

  private index(map: Map<string, Set<Connection>>, key: string, conn: Connection, add: boolean) {
    const set = map.get(key) ?? new Set<Connection>();
    if (add) set.add(conn);
    else set.delete(conn);
    if (set.size === 0) map.delete(key);
    else map.set(key, set);
  }

  async handle(req: Request, res: Response) {
    const { orgId, keyId } = req.apiKey!;

    // Claim a stream slot for this key; stale slots (no heartbeat for 3 intervals) are dropped first.
    const slotId = randomUUID();
    const slots = streamSlotsKey(keyId);
    const now = Date.now();
    const result = await this.redis
      .multi()
      .zremrangebyscore(slots, 0, now - this.heartbeatMs * 3)
      .zadd(slots, now, slotId)
      .zcard(slots)
      .expire(slots, Math.ceil((this.heartbeatMs * 3) / 1000))
      .exec();
    const open = Number(result?.[2]?.[1] ?? 0);
    if (open > this.maxPerKey) {
      await this.redis.zrem(slots, slotId);
      throw new AppError(429, 'TOO_MANY_STREAMS', `At most ${this.maxPerKey} open streams per API key`);
    }

    await this.subscribe();

    res.status(200).set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.flushHeaders();

    let closed = false;
    const conn: Connection = {
      orgId,
      keyId,
      pending: [],
      lastVersion: -1,
      send: (event, data, id) => {
        if (closed) return;
        res.write(
          `${id === undefined ? '' : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
        );
      },
      end: (reason) => {
        if (reason) conn.send('error', reason);
        cleanup();
        res.end();
      },
    };

    const heartbeat = setInterval(() => {
      if (closed) return;
      res.write(': ping\n\n');
      this.redis.zadd(slots, Date.now(), slotId).catch(() => {});
    }, this.heartbeatMs);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      this.index(this.byOrg, orgId, conn, false);
      this.index(this.byKey, keyId, conn, false);
      this.redis.zrem(slots, slotId).catch(() => {});
    };
    req.on('close', cleanup);

    // Register before loading the snapshot, so no event can slip between the snapshot and going live.
    this.index(this.byOrg, orgId, conn, true);
    this.index(this.byKey, keyId, conn, true);

    try {
      const snapshot = await this.snapshots.get(orgId);
      const lastEventId = Number.parseInt(req.get('last-event-id') ?? '', 10);
      if (lastEventId === snapshot.version) {
        // The client is already current: resume without resending everything.
        conn.lastVersion = snapshot.version;
      } else {
        // New client, or it missed events we no longer have: send the full rule set.
        conn.lastVersion = snapshot.version;
        conn.send('snapshot', snapshot, snapshot.version);
      }
      const pending = conn.pending ?? [];
      conn.pending = null;
      for (const event of pending) this.deliver(conn, event);
    } catch (err) {
      this.logger.error({ err, orgId }, 'could not start stream');
      conn.end({ code: 'STREAM_FAILED', message: 'Could not load flags, reconnect to retry' });
    }
  }

  /** Ends every open stream and the subscriber. */
  async close() {
    for (const conns of this.byOrg.values()) for (const conn of [...conns]) conn.end();
    if (this.subscriber) await (await this.subscriber).quit();
    this.subscriber = null;
  }
}
