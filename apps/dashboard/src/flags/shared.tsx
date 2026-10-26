import { useConnections, type BoardState } from '../api/queries';
import { cx } from '../ui/primitives';

/** The board columns, in order, with what each one means for end users. */
export const COLUMNS: { state: BoardState; title: string; meaning: string }[] = [
  { state: 'inactive', title: 'Inactive', meaning: 'Off for everyone' },
  { state: 'testing', title: 'Testing', meaning: 'On for listed users only' },
  { state: 'live', title: 'Live', meaning: 'On for all users' },
];

/** The StatePill colour keys use "off" for inactive. */
export const pillState = (s: BoardState) => (s === 'inactive' ? 'off' : s);

/** Who a flag reaches, in words. */
export function audienceText(f: { enabled: boolean; targetAll: boolean; targetCount: number }) {
  if (f.targetAll) return f.enabled ? 'All users' : 'All users when on';
  if (f.targetCount === 0) return 'No users listed';
  return `${f.targetCount} listed ${f.targetCount === 1 ? 'user' : 'users'}`;
}

/**
 * How many apps are listening to this org's live stream right now: the proof that a change lands
 * without a redeploy. Lime and pulsing when at least one is connected.
 */
export function ConnectedBadge({ className }: { className?: string }) {
  const { data, isError } = useConnections();
  if (isError || data === undefined) return null;
  const on = data > 0;
  return (
    <span
      className={cx(
        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap',
        on ? 'border-lime/25 bg-live-soft text-lime' : 'border-white/[0.08] bg-white/[0.03] text-muted',
        className,
      )}
      title="Apps using an API key from this organization with a live stream open"
    >
      <span className="relative flex size-2" aria-hidden="true">
        {on && (
          <span className="absolute inset-0 animate-ping rounded-full bg-lime opacity-60 motion-reduce:hidden" />
        )}
        <span className={cx('relative size-2 rounded-full', on ? 'bg-lime' : 'bg-off')} />
      </span>
      {on ? `${data} ${data === 1 ? 'app' : 'apps'} connected` : 'No apps connected'}
    </span>
  );
}
