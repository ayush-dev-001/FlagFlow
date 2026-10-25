import type { LucideIcon } from 'lucide-react';
import { Building2, Flag, ScrollText, Settings, UserRoundSearch, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { rise } from '../ui/motion';
import { PageHeader } from './PageHeader';

/** An honest empty state for screens that land in phase 7: what the page is for, and that it isn't here yet. */
function NotYet({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <motion.div
        {...rise}
        className="flex flex-col items-start gap-4 rounded-card border border-white/[0.06] bg-surface px-7 py-12 sm:items-center sm:text-center"
      >
        <span className="grid size-[47px] place-items-center rounded-[11px] bg-white/[0.08]">
          <Icon className="size-6 stroke-[1.5] text-white" aria-hidden="true" />
        </span>
        <p className="text-[22px] font-semibold tracking-[-0.03em] text-white">Not Available Yet</p>
        <p className="max-w-[46ch] text-[15px] text-pretty text-white/55">
          This screen is coming next. Its API is already in place.
        </p>
      </motion.div>
    </>
  );
}

export const FlagsPage = () => (
  <NotYet
    title="Flags"
    icon={Flag}
    description="Every flag in your organization, grouped as Inactive, Testing and Live."
  />
);
export const EndUsersPage = () => (
  <NotYet
    title="End Users"
    icon={UserRoundSearch}
    description="Look up an end-user ID such as U001 and see or change the flags it gets."
  />
);
export const TeamPage = () => (
  <NotYet title="Team" icon={Users} description="Members, roles and pending invites." />
);
export const AuditPage = () => (
  <NotYet
    title="Audit Log"
    icon={ScrollText}
    description="Who changed what, and when, across your organization."
  />
);
export const SettingsPage = () => (
  <NotYet title="Settings" icon={Settings} description="Organization name and API keys." />
);
export const AdminPage = () => (
  <NotYet
    title="Organizations"
    icon={Building2}
    description="Every organization on this FlagFlow instance."
  />
);

export function NotFoundPage() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-bold tracking-[-0.05em] text-white">
        Page Not Found
      </h1>
      <Link to="/" className="text-[15px] font-semibold text-lime hover:underline">
        Go to FlagFlow
      </Link>
    </div>
  );
}

export function ErrorPage() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-bold tracking-[-0.05em] text-white">
        Something Went Wrong
      </h1>
      <p className="max-w-[46ch] text-[15px] text-pretty text-white/55">
        The page hit an unexpected error. Reload to try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-[15px] font-semibold text-lime hover:underline"
      >
        Reload
      </button>
    </div>
  );
}
