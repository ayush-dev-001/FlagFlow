import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DASHBOARD_URL, FLAG_KEYS, type Flags, type LinkState, type LogEntry } from './api';

export const DEMO_USERS = [
  { id: 'U001', name: 'Maya Chen' },
  { id: 'U002', name: 'Leo Martins' },
  { id: 'U003', name: 'Sam Okafor' },
  { id: 'U004', name: 'Inés Duval' },
  { id: 'U005', name: 'Kofi Mensah' },
] as const;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

const LINK_TEXT: Record<LinkState, string> = {
  live: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Demo backend offline',
  unconfigured: 'No API key',
  rejected: 'API key rejected',
};

function LinkBadge({ link, version }: { link: LinkState; version: number | null }) {
  const live = link === 'live';
  return (
    <span
      role="status"
      className={cx(
        'inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap',
        live ? 'border-lime/25 bg-lime/10 text-lime' : 'border-white/10 bg-white/[0.04] text-ff-muted',
      )}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {live && (
          <span className="absolute inset-0 animate-ping rounded-full bg-lime opacity-60 motion-reduce:hidden" />
        )}
        <span className={cx('relative size-2 rounded-full', live ? 'bg-lime' : 'bg-[#8a8e8c]')} />
      </span>
      {LINK_TEXT[link]}
      {live && version !== null && <span className="font-mono text-lime/70">v{version}</span>}
    </span>
  );
}

/** Re-renders every few seconds so "12s ago" stays true. */
function useNow(ms = 5000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 5 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
};

function Setup({ link }: { link: LinkState }) {
  if (link === 'offline') {
    return (
      <p>
        Start it with <code className="font-mono text-white">npm run dev</code>.
      </p>
    );
  }
  if (link === 'unconfigured' || link === 'rejected') {
    return (
      <p>
        Give the demo a key with <code className="font-mono text-white">npm run demo:key</code>, then restart
        demo-api.
      </p>
    );
  }
  return null;
}

/**
 * FlagFlow's side of the demo, in FlagFlow's own look: who you are viewing as, what FlagFlow says for
 * them, and every change as it arrives.
 */
export function FlagFlowPanel({
  userId,
  onUser,
  flags,
  link,
  version,
  log,
  flash,
}: {
  userId: string;
  onUser: (id: string) => void;
  flags: Flags;
  link: LinkState;
  version: number | null;
  log: LogEntry[];
  flash: { key: string; n: number } | null;
}) {
  const now = useNow();
  const name = DEMO_USERS.find((u) => u.id === userId)?.name ?? userId;
  const setup = link === 'offline' || link === 'unconfigured' || link === 'rejected';

  return (
    <aside
      aria-label="FlagFlow demo panel"
      className="ff flex flex-col gap-6 bg-ink px-5 py-6 font-ff text-white lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-l lg:border-white/[0.06]"
    >
      <header className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[17px] font-bold tracking-tight">
          <span className="inline-block size-3 rounded-[3px] bg-lime" aria-hidden="true" />
          FlagFlow demo
        </span>
        <LinkBadge link={link} version={version} />
      </header>

      {setup ? (
        <div className="rounded-[14px] border border-white/[0.08] bg-ink-card p-4 text-[14px] leading-relaxed text-ff-muted">
          <Setup link={link} />
        </div>
      ) : (
        <p className="text-[14px] leading-relaxed text-ff-muted">
          Change a flag in the{' '}
          <a
            href={`${DASHBOARD_URL}/flags`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center font-semibold text-lime hover:underline"
          >
            dashboard
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
          . This app updates in under a second, with no refresh and no redeploy.
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ff-subtle">Viewing as</legend>
        <div className="grid grid-cols-5 gap-1 lg:grid-cols-1">
          {DEMO_USERS.map((u) => {
            const on = u.id === userId;
            return (
              <label
                key={u.id}
                className={cx(
                  'flex h-10 cursor-pointer items-center justify-center gap-3 rounded-[9px] px-1 text-[14px] lg:justify-between lg:px-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-lime',
                  on ? 'bg-lime/[0.12] text-white' : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                )}
              >
                <input
                  type="radio"
                  name="demo-user"
                  value={u.id}
                  checked={on}
                  onChange={() => onUser(u.id)}
                  className="sr-only"
                />
                <span className="hidden font-medium lg:inline">{u.name}</span>
                <span className={cx('font-mono text-[12px]', on ? 'text-lime' : 'text-ff-subtle')}>
                  {u.id}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby="ff-flags">
        <h2 id="ff-flags" className="mb-2 text-[13px] font-medium text-ff-subtle">
          What FlagFlow says for {name}
        </h2>
        <ul className="grid overflow-hidden rounded-[14px] border border-white/[0.06] bg-ink-card sm:grid-cols-2 lg:grid-cols-1">
          {FLAG_KEYS.map((k) => (
            <li
              key={flash?.key === k ? `${k}-${flash.n}` : k}
              className={cx(
                'flex h-10 items-center justify-between gap-3 border-b border-white/[0.05] px-3.5 last:border-b-0',
                flash?.key === k && 'ff-flash',
              )}
            >
              <span className="font-mono text-[13px] text-white/85">{k}</span>
              <span
                className={cx(
                  'inline-flex items-center gap-1.5 text-[12px] font-semibold',
                  flags[k] ? 'text-lime' : 'text-ff-subtle',
                )}
              >
                <span
                  className={cx(
                    'size-1.5 rounded-full',
                    flags[k] ? 'bg-lime shadow-[0_0_8px_#c4f04a]' : 'bg-[#8a8e8c]',
                  )}
                  aria-hidden="true"
                />
                {flags[k] ? 'On' : 'Off'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ff-log" className="min-h-0">
        <h2 id="ff-log" className="mb-2 text-[13px] font-medium text-ff-subtle">
          Live changes
        </h2>
        {/* Always in the page, so the first change is announced too. */}
        <div aria-live="polite">
          {log.length === 0 ? (
            <p className="text-[13px] text-ff-subtle">Nothing yet. Changes from the dashboard appear here.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {log.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 text-white/65">
                    <code className="font-mono text-white">{e.key}</code>{' '}
                    {e.deleted ? (
                      'was deleted'
                    ) : e.now === null ? (
                      <span className="text-ff-subtle">changed, no effect for {userId}</span>
                    ) : (
                      <>
                        turned{' '}
                        <span className={e.now ? 'font-semibold text-lime' : 'font-semibold text-white'}>
                          {e.now ? 'on' : 'off'}
                        </span>{' '}
                        for {userId}
                      </>
                    )}
                  </span>
                  <span className="shrink-0 text-[12px] text-ff-subtle">{ago(e.at, now)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </aside>
  );
}
