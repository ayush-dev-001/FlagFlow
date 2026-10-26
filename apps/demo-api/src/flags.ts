// The demo backend's view of FlagFlow: the six flags its frontend reacts to, the connection state, and a
// way to hear about changes. index.ts backs it with the real flag-client; tests use a fake.

export const DEMO_FLAGS = [
  'dark_mode',
  'chat_widget',
  'analytics_dashboard',
  'new_checkout',
  'beta_banner',
  'export_report',
] as const;

export type DemoFlag = (typeof DEMO_FLAGS)[number];
export type DemoFlags = Record<DemoFlag, boolean>;

/** live: following the stream. connecting: before the first snapshot. reconnecting: lost, retrying. */
export type LinkState = 'unconfigured' | 'connecting' | 'live' | 'reconnecting' | 'rejected';

export interface FlagChange {
  type: 'flag.updated' | 'flag.deleted';
  key: string;
  version: number;
}

export interface FlagSource {
  state(): LinkState;
  /** The last connection problem, for /health. Messages never include the API key. */
  lastError?(): { message: string; at: string } | null;
  version(): number | null;
  /** Every flag FlagFlow knows for this user; unknown flags are off. */
  evaluate(userId: string): Record<string, boolean>;
  /** Called after any change to the rule set or the link state. Returns an unsubscribe function. */
  subscribe(listener: (change?: FlagChange) => void): () => void;
}

/** The six demo flags for a user, off unless FlagFlow says on. */
export function demoFlags(source: FlagSource, userId: string): DemoFlags {
  const all = source.evaluate(userId);
  return Object.fromEntries(DEMO_FLAGS.map((k) => [k, all[k] === true])) as DemoFlags;
}
