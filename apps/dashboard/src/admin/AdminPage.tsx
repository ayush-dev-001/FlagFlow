import { Building2 } from 'lucide-react';
import { useState } from 'react';
import { type OrganizationSummary, useOrganizations, useSetOrgActive } from '../api/queries';
import { PageHeader } from '../shell/PageHeader';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingRows,
  messageOf,
  Panel,
  SearchInput,
  Time,
} from '../ui/kit';
import { Button, cx } from '../ui/primitives';
import { useToast } from '../ui/toast';

function OrgRow({ org }: { org: OrganizationSummary }) {
  const setActive = useSetOrgActive();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const change = (isActive: boolean) =>
    setActive.mutate(
      { id: org.id, isActive },
      {
        onSuccess: () => {
          setConfirming(false);
          toast(`${org.name} ${isActive ? 'reactivated' : 'deactivated'}`);
        },
        onError: (e) => {
          setConfirming(false);
          toast(messageOf(e), 'error');
        },
      },
    );

  const plural = (n: number, one: string, many: string) => [n === 1 ? one : many, n] as [string, number];
  const stats = [
    plural(org.members, 'member', 'members'),
    plural(org.flags, 'flag', 'flags'),
    plural(org.activeApiKeys, 'API key', 'API keys'),
  ];

  return (
    <li className="flex flex-col gap-3 border-b border-white/[0.05] py-4 last:border-b-0 md:flex-row md:items-center md:gap-6">
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-[15px] font-medium', org.isActive ? 'text-white' : 'text-subtle')}>
          {org.name}
        </p>
        <p className="truncate text-[13px] text-subtle">
          <span className="font-mono">{org.slug}</span> · created <Time iso={org.createdAt} />
        </p>
      </div>
      <p className="flex gap-5 text-[13px]">
        {stats.map(([label, n]) => (
          <span key={label} className="flex items-baseline gap-1.5">
            <span className="tabular font-semibold text-white">{n}</span>
            <span className="text-subtle">{label}</span>
          </span>
        ))}
      </p>
      <div className="flex items-center justify-between gap-4 md:w-56 md:justify-end">
        <span
          className={cx(
            'inline-flex items-center gap-1.5 text-[13px] font-semibold',
            org.isActive ? 'text-lime' : 'text-muted',
          )}
        >
          <span
            className={cx('size-1.5 rounded-full', org.isActive ? 'bg-lime' : 'bg-off')}
            aria-hidden="true"
          />
          {org.isActive ? 'Active' : 'Deactivated'}
        </span>
        {org.isActive ? (
          <Button variant="ghost" onClick={() => setConfirming(true)} className="-mr-3">
            Deactivate
          </Button>
        ) : (
          <Button
            variant="ghost"
            loading={setActive.isPending}
            onClick={() => change(true)}
            className="-mr-3"
          >
            Reactivate
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Deactivate ${org.name}?`}
        confirmLabel="Deactivate"
        pending={setActive.isPending}
        onConfirm={() => change(false)}
      >
        Its {org.members} {org.members === 1 ? 'member is' : 'members are'} logged out at once and can't log
        in, and its apps stop receiving flags: API keys are refused and live streams close. Nothing is
        deleted; reactivating restores everything.
      </ConfirmDialog>
    </li>
  );
}

export function AdminPage() {
  const orgs = useOrganizations();
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = (orgs.data ?? []).filter((o) => o.name.toLowerCase().includes(term) || o.slug.includes(term));

  return (
    <>
      <PageHeader title="Organizations" description="Every organization on this FlagFlow instance." />
      <Panel
        title={
          orgs.data
            ? `${orgs.data.length} ${orgs.data.length === 1 ? 'Organization' : 'Organizations'}`
            : 'Organizations'
        }
        actions={
          <SearchInput
            label="Search organizations"
            placeholder="Search by name"
            value={search}
            onChange={setSearch}
            className="w-full sm:w-64"
          />
        }
        bodyClassName="px-5 py-1 sm:px-6"
      >
        {orgs.isPending ? (
          <div className="py-4">
            <LoadingRows label="Loading organizations" />
          </div>
        ) : orgs.isError ? (
          <ErrorState error={orgs.error} onRetry={() => void orgs.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Building2} title={term ? 'No Matches' : 'No Organizations Yet'}>
            {term
              ? `Nothing matches “${search.trim()}”.`
              : 'Organizations appear here when someone signs up.'}
          </EmptyState>
        ) : (
          <ul aria-label="Organizations">
            {shown.map((o) => (
              <OrgRow key={o.id} org={o} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
