import { evaluate, type FlagRule } from './evaluate.js';

/** An org's full rule set at one version, as served by GET /v1/snapshot and the stream's `snapshot` event. */
export interface Snapshot {
  version: number;
  flags: FlagRule[];
}

/** Events on GET /v1/stream. `version` is also the SSE event id, for Last-Event-ID resume. */
export type FlagEvent =
  | { type: 'flag.updated'; version: number; flag: FlagRule }
  | { type: 'flag.deleted'; version: number; key: string };

/** Every flag in the snapshot, evaluated for one user. */
export function evaluateAll(snapshot: Snapshot, userId: string): Record<string, boolean> {
  return Object.fromEntries(snapshot.flags.map((f) => [f.key, evaluate(f, userId)]));
}

/** Applies a stream event to a snapshot, returning a new one. Events at or below the current version are ignored. */
export function applyEvent(snapshot: Snapshot, event: FlagEvent): Snapshot {
  if (event.version <= snapshot.version) return snapshot;
  const key = event.type === 'flag.updated' ? event.flag.key : event.key;
  const others = snapshot.flags.filter((f) => f.key !== key);
  return {
    version: event.version,
    flags: event.type === 'flag.updated' ? [...others, event.flag] : others,
  };
}
