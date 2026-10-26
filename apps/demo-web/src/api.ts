import { useEffect, useRef, useState } from 'react';

// Talks to demo-api only. The FlagFlow API key lives there; this browser app never sees it.
export const DEMO_API = (import.meta.env.VITE_DEMO_API_URL as string | undefined) ?? 'http://localhost:4100';
export const DASHBOARD_URL =
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ?? 'http://localhost:5173';

export const FLAG_KEYS = [
  'dark_mode',
  'chat_widget',
  'analytics_dashboard',
  'new_checkout',
  'beta_banner',
  'export_report',
] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];
export type Flags = Record<FlagKey, boolean>;

export type LinkState = 'unconfigured' | 'connecting' | 'live' | 'reconnecting' | 'rejected' | 'offline';

export interface LogEntry {
  id: number;
  at: number;
  key: string;
  /** The value for the viewed user after the change, or null when it didn't change for them. */
  now: boolean | null;
  deleted: boolean;
}

const OFF: Flags = Object.fromEntries(FLAG_KEYS.map((k) => [k, false])) as Flags;

interface StreamMessage {
  state: Exclude<LinkState, 'offline'>;
  version: number | null;
  flags: Flags;
  change: { type: 'flag.updated' | 'flag.deleted'; key: string; version: number } | null;
}

/**
 * The viewed user's six flags, kept live over demo-api's event stream. Every change in FlagFlow arrives
 * here within a second and is added to the log, noting whether it changed anything for this user.
 */
export function useLiveFlags(userId: string) {
  const [flags, setFlags] = useState<Flags>(OFF);
  const [link, setLink] = useState<LinkState>('connecting');
  const [version, setVersion] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [flash, setFlash] = useState<{ key: string; n: number } | null>(null);
  const current = useRef<Flags>(OFF);
  const nextId = useRef(0);

  useEffect(() => {
    // A new user starts from nothing: never show the previous user's flags under this one's name.
    current.current = OFF;
    setFlags(OFF);
    setLink('connecting');
    setVersion(null);
    setFlash(null);
    setLog([]);
    let heard = false;
    const source = new EventSource(`${DEMO_API}/api/events?userId=${encodeURIComponent(userId)}`);
    source.addEventListener('flags', (e) => {
      heard = true;
      const msg = JSON.parse((e as MessageEvent<string>).data) as StreamMessage;
      const before = current.current;
      current.current = msg.flags;
      setFlags(msg.flags);
      setLink(msg.state);
      setVersion(msg.version);
      if (msg.change) {
        const key = msg.change.key;
        const known = (FLAG_KEYS as readonly string[]).includes(key);
        const changedForUser = known && before[key as FlagKey] !== msg.flags[key as FlagKey];
        setLog((l) =>
          [
            {
              id: ++nextId.current,
              at: Date.now(),
              key,
              now: changedForUser ? msg.flags[key as FlagKey] : null,
              deleted: msg.change!.type === 'flag.deleted',
            },
            ...l,
          ].slice(0, 30),
        );
        if (changedForUser) setFlash({ key, n: nextId.current });
      }
    });
    // EventSource retries by itself. A drop after we were connected is a reconnect; never having reached
    // the demo backend (or it giving up) is offline, with the setup hint.
    source.onerror = () =>
      setLink(heard && source.readyState !== EventSource.CLOSED ? 'reconnecting' : 'offline');
    return () => source.close();
  }, [userId]);

  return { flags, link, version, log, flash };
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DEMO_API}${path}`);
  const body = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `Request failed (${res.status})`);
  return body;
}

export async function postJson<T>(path: string, data: unknown): Promise<T> {
  const res = await fetch(`${DEMO_API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `Request failed (${res.status})`);
  return body;
}

export const money = (n: number) => `$${n.toFixed(0)}`;
