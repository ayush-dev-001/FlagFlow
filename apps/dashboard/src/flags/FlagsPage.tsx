import { Flag, Plus, SearchX } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import { type BoardState, type FlagSummary, useFlags, useToggleFlag } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../shell/PageHeader';
import { EmptyState, ErrorState, messageOf, Segmented, SearchInput, Skeleton, Switch, Time } from '../ui/kit';
import { transition } from '../ui/motion';
import { Button, cx, StatePill } from '../ui/primitives';
import { useToast } from '../ui/toast';
import { CreateFlagDialog } from './CreateFlagDialog';
import { audienceText, COLUMNS, ConnectedBadge, pillState } from './shared';

type Filter = 'all' | BoardState;

function FlagCard({ flag }: { flag: FlagSummary }) {
  const toggle = useToggleFlag();
  const toast = useToast();
  return (
    <motion.li
      layout="position"
      layoutId={flag.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition.base}
    >
      {/* The key is the link; its hit area stretches over the card, and the switch sits above it. */}
      <div className="group relative flex flex-col gap-3 rounded-panel border border-white/[0.06] bg-surface p-4 transition-colors duration-150 focus-within:border-white/[0.14] hover:border-white/[0.12] hover:bg-raised">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/flags/${flag.id}`}
            className="min-w-0 font-mono text-[14px] leading-6 break-all text-white after:absolute after:inset-0 after:rounded-panel focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-lime"
          >
            {flag.key}
          </Link>
          <Switch
            className="relative z-10"
            checked={flag.enabled}
            label={`${flag.key} ${flag.enabled ? 'on' : 'off'}`}
            onChange={() =>
              toggle.mutate(flag.id, {
                onSuccess: (f) => toast(`${f.key} is ${f.enabled ? 'on' : 'off'}`),
                onError: (e) => toast(messageOf(e), 'error'),
              })
            }
          />
        </div>
        <p
          className={cx(
            'line-clamp-2 text-[14px] leading-snug',
            flag.description ? 'text-white/55' : 'text-subtle italic',
          )}
        >
          {flag.description || 'No description'}
        </p>
        <div className="flex items-center justify-between gap-3 text-[13px] text-subtle">
          <span>{audienceText(flag)}</span>
          <Time iso={flag.updatedAt} />
        </div>
      </div>
    </motion.li>
  );
}

function Column({ state, title, meaning, flags }: (typeof COLUMNS)[number] & { flags: FlagSummary[] }) {
  return (
    <section aria-labelledby={`col-${state}`} className="flex min-w-0 flex-col gap-3">
      <header className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5">
          <h2 id={`col-${state}`} className="sr-only">
            {title}
          </h2>
          <StatePill state={pillState(state)} />
          <span className="text-[13px] text-subtle">{meaning}</span>
        </div>
        <span
          className="tabular text-[14px] font-semibold text-white/70"
          aria-label={`${flags.length} flags`}
        >
          {flags.length}
        </span>
      </header>
      <ul className="flex flex-col gap-2.5">
        {flags.map((f) => (
          <FlagCard key={f.id} flag={f} />
        ))}
        {flags.length === 0 && (
          <li className="rounded-panel border border-dashed border-white/[0.08] px-4 py-6 text-center text-[14px] text-subtle">
            No {title.toLowerCase()} flags
          </li>
        )}
      </ul>
    </section>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <span role="status" className="sr-only">
        Loading flags
      </span>
      {COLUMNS.map((c) => (
        <div key={c.state} className="flex flex-col gap-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-[118px]" />
          <Skeleton className="h-[118px]" />
        </div>
      ))}
    </div>
  );
}

export function FlagsPage() {
  const { organization } = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const term = useDeferredValue(search.trim());
  const flags = useFlags(term);

  const list = flags.data ?? [];
  const columns = COLUMNS.filter((c) => filter === 'all' || c.state === filter);
  const nothingYet = flags.isSuccess && list.length === 0 && term === '';

  return (
    <>
      <PageHeader
        title="Flags"
        description={`Every flag in ${organization?.name ?? 'your organization'}, by who it reaches.`}
        actions={
          <Button onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden="true" />}>
            New flag
          </Button>
        }
      />

      {!nothingYet && (
        <div className="mb-7 flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput
            label="Search flags"
            placeholder="Search by key or description"
            value={search}
            onChange={setSearch}
            className="md:max-w-[340px] md:flex-1"
          />
          <div className="md:w-[380px]">
            <Segmented<Filter>
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                ...COLUMNS.map((c) => ({ value: c.state, label: c.title })),
              ]}
            />
          </div>
          <ConnectedBadge className="md:ml-auto" />
        </div>
      )}

      {flags.isPending ? (
        <BoardSkeleton />
      ) : flags.isError ? (
        <ErrorState error={flags.error} onRetry={() => void flags.refetch()} />
      ) : nothingYet ? (
        <div className="rounded-card border border-white/[0.06] bg-surface px-6 py-6">
          <EmptyState
            icon={Flag}
            title="No Flags Yet"
            action={
              <Button onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden="true" />}>
                Create your first flag
              </Button>
            }
          >
            A flag is a switch your code checks, such as{' '}
            <code className="font-mono text-white">new_checkout</code>. Create one, list a few end users to
            test with, then turn it on for everyone.
          </EmptyState>
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={SearchX} title="No Matching Flags">
          Nothing matches “{term}”. Try part of a key, such as{' '}
          <code className="font-mono text-white">dark</code>.
        </EmptyState>
      ) : (
        <LayoutGroup>
          <div className={cx('grid items-start gap-6', columns.length > 1 && 'lg:grid-cols-3')}>
            {columns.map((c) => (
              <Column key={c.state} {...c} flags={list.filter((f) => f.state === c.state)} />
            ))}
          </div>
        </LayoutGroup>
      )}

      <CreateFlagDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
