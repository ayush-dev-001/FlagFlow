import { Flag, UserRoundSearch } from 'lucide-react';
import { motion } from 'motion/react';
import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import { type EndUserFlag, useChangeTargets, useEndUser } from '../api/queries';
import { PageHeader } from '../shell/PageHeader';
import { EmptyState, ErrorState, LoadingRows, messageOf, Panel, Switch } from '../ui/kit';
import { rise } from '../ui/motion';
import { Button, cx } from '../ui/primitives';
import { useToast } from '../ui/toast';

/** Why this user gets the flag or doesn't, in a few words. */
function reason(f: EndUserFlag) {
  if (!f.flagEnabled) return 'Flag is off';
  if (f.targetAll) return 'On for all users';
  return f.targeted ? 'They are on its list' : 'Only its listed users get it';
}

function Row({ flag, userId }: { flag: EndUserFlag; userId: string }) {
  const targets = useChangeTargets();
  const toast = useToast();
  return (
    <li className="flex flex-col gap-3 border-b border-white/[0.05] py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <Link to={`/flags/${flag.id}`} className="font-mono text-[14px] break-all text-white hover:underline">
          {flag.key}
        </Link>
        {flag.description && (
          <p className="mt-0.5 line-clamp-1 text-[14px] text-white/50">{flag.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-6 sm:justify-end">
        <div className="flex w-40 flex-col sm:items-end">
          <span
            className={cx(
              'inline-flex items-center gap-1.5 text-[14px] font-semibold',
              flag.enabled ? 'text-lime' : 'text-muted',
            )}
          >
            <span
              className={cx(
                'size-1.5 rounded-full',
                flag.enabled ? 'bg-lime shadow-[0_0_8px_var(--color-lime)]' : 'bg-off',
              )}
              aria-hidden="true"
            />
            {flag.enabled ? 'Gets it' : "Doesn't get it"}
          </span>
          <span className="text-[13px] text-subtle">{reason(flag)}</span>
        </div>
        <label className="flex items-center gap-2.5 text-[13px] text-white/60">
          On its list
          <Switch
            checked={flag.targeted}
            disabled={targets.isPending}
            label={`List ${userId} for ${flag.key}`}
            onChange={(next) =>
              targets.mutate(
                { id: flag.id, ...(next ? { add: [userId] } : { remove: [userId] }) },
                {
                  onSuccess: () =>
                    toast(next ? `Listed ${userId} for ${flag.key}` : `Unlisted ${userId} from ${flag.key}`),
                  onError: (e) => toast(messageOf(e), 'error'),
                },
              )
            }
          />
        </label>
      </div>
    </li>
  );
}

export function EndUsersPage() {
  const [params, setParams] = useSearchParams();
  const current = params.get('id') ?? '';
  const [draft, setDraft] = useState(current);
  const lookup = useEndUser(current);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = draft.trim();
    setParams(id ? { id } : {});
  }

  const flags = lookup.data ?? [];
  const getting = flags.filter((f) => f.enabled).length;
  const invalid = lookup.error instanceof ApiError && lookup.error.code === 'VALIDATION_ERROR';

  return (
    <>
      <PageHeader
        title="End Users"
        description="Look up one of your users by your own ID, such as U001, to see which flags they get and why."
      />

      <form onSubmit={onSubmit} className="mb-8 flex max-w-[560px] flex-col gap-2 sm:flex-row">
        <label htmlFor="end-user-id" className="sr-only">
          End-user ID
        </label>
        <input
          id="end-user-id"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="U001"
          autoComplete="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-none rounded-control sm:flex-1 border border-white/10 bg-ink/70 px-3.5 font-mono text-[15px] text-white placeholder:text-subtle hover:border-white/20 focus:border-lime/70 focus:shadow-[0_0_0_3px_rgb(196_240_74/0.18)] focus:outline-none focus-visible:outline-none"
        />
        <Button type="submit" className="h-11" disabled={draft.trim() === ''}>
          Look up
        </Button>
      </form>

      {current === '' ? (
        <EmptyState icon={UserRoundSearch} title="Look Up an End User">
          Enter the ID your app uses for a user. FlagFlow keeps no list of your users, so any ID works: you
          see exactly what that user would get right now.
        </EmptyState>
      ) : lookup.isPending ? (
        <LoadingRows label={`Looking up ${current}`} />
      ) : invalid ? (
        <p role="alert" className="text-[15px] text-danger">
          “{current}” isn't a valid ID. Use letters, digits and _ . : @ - only.
        </p>
      ) : lookup.isError ? (
        <ErrorState error={lookup.error} onRetry={() => void lookup.refetch()} />
      ) : (
        <motion.div {...rise} key={current}>
          <Panel
            title={current}
            description={
              flags.length === 0
                ? undefined
                : `Gets ${getting} of ${flags.length} ${flags.length === 1 ? 'flag' : 'flags'} right now.`
            }
          >
            {flags.length === 0 ? (
              <EmptyState
                icon={Flag}
                title="No Flags Yet"
                action={
                  <Link to="/flags" className="font-semibold text-lime hover:underline">
                    Go to flags
                  </Link>
                }
              >
                Your organization has no flags, so this user gets nothing yet.
              </EmptyState>
            ) : (
              <ul aria-label={`Flags for ${current}`}>
                {flags.map((f) => (
                  <Row key={f.id} flag={f} userId={current} />
                ))}
              </ul>
            )}
          </Panel>
        </motion.div>
      )}
    </>
  );
}
