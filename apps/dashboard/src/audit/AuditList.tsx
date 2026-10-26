import { ScrollText } from 'lucide-react';
import { useMemo } from 'react';
import { useAudit, useFlags, useMembers } from '../api/queries';
import { EmptyState, ErrorState, LoadingRows, Time } from '../ui/kit';
import { Button } from '../ui/primitives';
import { type AuditNames, describeEntry } from './describe';

function useAuditNames(): AuditNames {
  const flags = useFlags('');
  const members = useMembers();
  return useMemo(
    () => ({
      flags: new Map((flags.data ?? []).map((f) => [f.id, f.key])),
      people: new Map((members.data ?? []).map((m) => [m.id, m.name])),
    }),
    [flags.data, members.data],
  );
}

/** The audit log as sentences, newest first, a page at a time. */
export function AuditList({
  filters,
  emptyText,
  compact,
}: {
  filters: { flagId?: string; actorId?: string };
  emptyText: string;
  compact?: boolean;
}) {
  const audit = useAudit(filters);
  const names = useAuditNames();

  if (audit.isPending) return <LoadingRows rows={compact ? 3 : 6} label="Loading activity" />;
  if (audit.isError) return <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />;

  const entries = audit.data.pages.flatMap((p) => p.entries);
  if (entries.length === 0) {
    return (
      <EmptyState icon={ScrollText} title="Nothing Yet">
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <div>
      <ol className="flex flex-col">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-0.5 border-b border-white/[0.05] py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <p className="min-w-0 text-[15px] leading-snug text-white/60">
              <span className="font-semibold text-white">{e.actor?.name ?? 'Someone'}</span>{' '}
              {describeEntry(e, names)}
            </p>
            <Time iso={e.createdAt} className="shrink-0 text-[13px] whitespace-nowrap text-subtle" />
          </li>
        ))}
      </ol>
      {audit.hasNextPage && (
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => void audit.fetchNextPage()}
            loading={audit.isFetchingNextPage}
          >
            Load older activity
          </Button>
        </div>
      )}
    </div>
  );
}
