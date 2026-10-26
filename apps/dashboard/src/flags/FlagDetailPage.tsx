import { ArrowLeft, FlagOff, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import {
  type FlagDetail,
  useChangeTargets,
  useDeleteFlag,
  useFlag,
  useToggleFlag,
  useUpdateFlag,
} from '../api/queries';
import { AuditList } from '../audit/AuditList';
import { useAuth } from '../auth/AuthProvider';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormError,
  messageOf,
  Panel,
  SearchInput,
  Segmented,
  Skeleton,
  Switch,
  TextArea,
  Time,
} from '../ui/kit';
import { rise, transition } from '../ui/motion';
import { Button, cx, StatePill } from '../ui/primitives';
import { useToast } from '../ui/toast';
import { parseIds } from './CreateFlagDialog';
import { ConnectedBadge, pillState } from './shared';

/** What the current settings mean for end users, in one sentence. */
function reach(f: FlagDetail) {
  if (!f.enabled) return 'Nobody gets it. Your code sees false for every user.';
  if (f.targetAll) return 'Every user gets it.';
  if (f.targets.length === 0) return 'It is on, but no users are listed, so nobody gets it yet.';
  return `${f.targets.length} listed ${f.targets.length === 1 ? 'user gets' : 'users get'} it. Everyone else doesn't.`;
}

function StatusPanel({ flag }: { flag: FlagDetail }) {
  const toggle = useToggleFlag();
  const toast = useToast();
  return (
    <Panel>
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[22px] font-bold tracking-[-0.04em] text-white">{flag.enabled ? 'On' : 'Off'}</p>
          <p className="mt-1 text-[15px] text-pretty text-white/55">{reach(flag)}</p>
        </div>
        <Switch
          size="lg"
          checked={flag.enabled}
          label={`Turn ${flag.key} ${flag.enabled ? 'off' : 'on'}`}
          onChange={() =>
            toggle.mutate(flag.id, {
              onSuccess: (f) => toast(`${f.key} is ${f.enabled ? 'on' : 'off'}`),
              onError: (e) => toast(messageOf(e), 'error'),
            })
          }
        />
      </div>
    </Panel>
  );
}

const SHOWN = 60;

function AudiencePanel({ flag }: { flag: FlagDetail }) {
  const update = useUpdateFlag(flag.id);
  const targets = useChangeTargets();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState('');

  const visible = flag.targets.filter((t) => t.toLowerCase().includes(filter.trim().toLowerCase()));
  const addError =
    targets.error instanceof ApiError
      ? (targets.error.fieldError('add') ?? targets.error.message)
      : targets.error
        ? messageOf(targets.error)
        : null;

  function add(e: FormEvent) {
    e.preventDefault();
    const ids = parseIds(draft);
    if (ids.length === 0) return;
    targets.mutate(
      { id: flag.id, add: ids },
      {
        onSuccess: () => {
          setDraft('');
          toast(`Added ${ids.length === 1 ? ids[0] : `${ids.length} users`} to ${flag.key}`);
        },
      },
    );
  }

  function remove(id: string) {
    targets.mutate(
      { id: flag.id, remove: [id] },
      {
        onSuccess: () => toast(`Removed ${id} from ${flag.key}`),
        onError: (e) => toast(messageOf(e), 'error'),
      },
    );
  }

  return (
    <Panel title="Audience" description="Who gets this flag while it is on.">
      <Segmented
        label="Audience"
        value={flag.targetAll ? 'all' : 'listed'}
        onChange={(v) =>
          update.mutate(
            { targetAll: v === 'all' },
            {
              onSuccess: (f) =>
                toast(`${f.key} now reaches ${f.targetAll ? 'all users' : 'listed users only'}`),
              onError: (e) => toast(messageOf(e), 'error'),
            },
          )
        }
        options={[
          { value: 'listed', label: 'Listed users' },
          { value: 'all', label: 'All users' },
        ]}
      />

      <div className={cx('mt-6 transition-opacity duration-200', flag.targetAll && 'opacity-60')}>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-medium text-white">Listed users</h3>
          <span className="tabular text-[13px] text-subtle">{flag.targets.length}</span>
        </div>
        {flag.targetAll && (
          <p className="mb-3 text-[14px] text-white/55">
            Not used while the flag reaches all users. They are kept for when you switch back.
          </p>
        )}

        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="add-targets">
            End-user IDs to add
          </label>
          <input
            id="add-targets"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="U001, U002"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="add-targets-hint"
            className="h-10 min-w-0 flex-none rounded-control sm:flex-1 border border-white/10 bg-ink/70 px-3.5 font-mono text-[14px] text-white placeholder:text-subtle hover:border-white/20 focus:border-lime/70 focus:shadow-[0_0_0_3px_rgb(196_240_74/0.18)] focus:outline-none focus-visible:outline-none"
          />
          <Button
            type="submit"
            variant="secondary"
            loading={targets.isPending}
            disabled={parseIds(draft).length === 0}
            icon={<Plus className="size-4" aria-hidden="true" />}
          >
            Add
          </Button>
        </form>
        <p id="add-targets-hint" className="mt-2 text-[13px] text-subtle">
          Your own user IDs. Paste several at once, separated by commas or spaces.
        </p>
        {addError && (
          <p role="alert" className="mt-2 text-[14px] text-danger">
            {addError}
          </p>
        )}

        {flag.targets.length > 12 && (
          <SearchInput
            label="Find a listed user"
            placeholder="Find a listed user"
            value={filter}
            onChange={setFilter}
            className="mt-4"
          />
        )}

        {flag.targets.length === 0 ? (
          <p className="mt-4 text-[14px] text-subtle">No users listed yet.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Listed users">
            <AnimatePresence initial={false}>
              {visible.slice(0, SHOWN).map((t) => (
                <motion.li
                  key={t}
                  layout
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={transition.fast}
                  className="flex h-8 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] pr-1 pl-3 font-mono text-[13px] text-white"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    aria-label={`Remove ${t}`}
                    className="grid size-6 place-items-center rounded-full text-subtle hover:bg-white/[0.08] hover:text-white"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {visible.length > SHOWN && (
          <p className="mt-3 text-[13px] text-subtle">
            Showing {SHOWN} of {visible.length}. Use the search to find the rest.
          </p>
        )}
      </div>
    </Panel>
  );
}

function DescriptionPanel({ flag }: { flag: FlagDetail }) {
  const update = useUpdateFlag(flag.id);
  const toast = useToast();
  const [value, setValue] = useState(flag.description);
  const changed = value.trim() !== flag.description;

  return (
    <Panel title="Description">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ description: value }, { onSuccess: () => toast('Description saved') });
        }}
        className="flex flex-col gap-3"
      >
        <TextArea
          label="Description"
          hideLabel
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          placeholder="What it controls, and when it can be removed."
          rows={3}
        />
        <FormError error={update.error} />
        <div className="flex justify-end gap-2">
          {changed && (
            <Button type="button" variant="ghost" onClick={() => setValue(flag.description)}>
              Discard
            </Button>
          )}
          <Button type="submit" variant="secondary" disabled={!changed} loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function DetailsPanel({ flag }: { flag: FlagDetail }) {
  const rows: [string, ReactNode][] = [
    [
      'Created',
      <>
        <Time iso={flag.createdAt} />
        {flag.createdBy && <> by {flag.createdBy.name}</>}
      </>,
    ],
    [
      'Last changed',
      <>
        <Time iso={flag.updatedAt} />
        {flag.updatedBy && <> by {flag.updatedBy.name}</>}
      </>,
    ],
    ['Version', <span className="tabular font-mono">{flag.version}</span>],
  ];
  return (
    <Panel title="Details">
      <dl className="flex flex-col gap-3 text-[14px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-subtle">{label}</dt>
            <dd className="text-right text-white/80">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function DangerPanel({ flag }: { flag: FlagDetail }) {
  const del = useDeleteFlag();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <Panel title="Delete Flag">
      <p className="text-[14px] text-white/55">
        Apps that still check <code className="font-mono text-white">{flag.key}</code> will get false for
        every user.
      </p>
      <Button
        variant="danger"
        className="mt-4"
        onClick={() => setOpen(true)}
        icon={<Trash2 className="size-4" aria-hidden="true" />}
      >
        Delete flag
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          del.reset();
          setOpen(false);
        }}
        title={`Delete ${flag.key}?`}
        confirmLabel="Delete flag"
        pending={del.isPending}
        error={del.error}
        onConfirm={() =>
          del.mutate(flag.id, {
            onSuccess: () => {
              toast(`Deleted ${flag.key}`);
              void navigate('/flags', { replace: true });
            },
          })
        }
      >
        This removes the flag and its {flag.targets.length} listed users. Connected apps see it disappear at
        once. Its history stays in the audit log.
      </ConfirmDialog>
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <span role="status" className="sr-only">
        Loading flag
      </span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

export function FlagDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const flag = useFlag(id);
  const isAdmin = user?.role === 'ADMIN';

  const back = (
    <Link
      to="/flags"
      className="mb-6 inline-flex items-center gap-1.5 rounded-control text-[14px] font-medium text-white/55 hover:text-white"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Flags
    </Link>
  );

  if (flag.isPending)
    return (
      <>
        {back}
        <DetailSkeleton />
      </>
    );
  if (flag.isError) {
    const missing =
      flag.error instanceof ApiError && (flag.error.status === 404 || flag.error.status === 400);
    return (
      <>
        {back}
        {missing ? (
          <EmptyState icon={FlagOff} title="Flag Not Found">
            It may have been deleted. Its history is still in the audit log.
          </EmptyState>
        ) : (
          <ErrorState error={flag.error} onRetry={() => void flag.refetch()} />
        )}
      </>
    );
  }

  const f = flag.data;
  return (
    <>
      {back}
      <motion.header
        {...rise}
        className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 font-mono text-[clamp(1.6rem,3vw,2.1rem)] leading-tight font-semibold tracking-[-0.03em] break-all text-white">
              {f.key}
            </h1>
            <StatePill state={pillState(f.state)} />
          </div>
          {f.description && <p className="mt-3 max-w-[60ch] text-[16px] text-white/55">{f.description}</p>}
        </div>
        <ConnectedBadge className="self-start" />
      </motion.header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <StatusPanel flag={f} />
          <AudiencePanel flag={f} />
          <Panel title="History" description={isAdmin ? undefined : 'Only admins can see who changed what.'}>
            {isAdmin ? (
              <AuditList filters={{ flagId: f.id }} emptyText="No changes recorded for this flag." compact />
            ) : (
              <p className="text-[14px] text-subtle">
                Last changed <Time iso={f.updatedAt} />
                {f.updatedBy && <> by {f.updatedBy.name}</>}.
              </p>
            )}
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <DescriptionPanel key={f.description} flag={f} />
          <DetailsPanel flag={f} />
          {isAdmin && <DangerPanel flag={f} />}
        </div>
      </div>
    </>
  );
}
