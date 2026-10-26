import { MailPlus, Users } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ApiError } from '../api/client';
import {
  type Member,
  type OrgRole,
  useCreateInvite,
  useInvites,
  useMembers,
  useRevokeInvite,
  useUpdateMember,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../shell/PageHeader';
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  FormError,
  LoadingRows,
  messageOf,
  Panel,
  relativeTime,
  Select,
  Time,
} from '../ui/kit';
import { formText } from '../ui/form';
import { Button, cx, Field } from '../ui/primitives';
import { useToast } from '../ui/toast';

const roleLabel = (r: string) => (r === 'ADMIN' ? 'Admin' : 'Member');

function Initials({ name, muted }: { name: string; muted?: boolean }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold',
        muted ? 'bg-white/[0.05] text-subtle' : 'bg-white/[0.09] text-white',
      )}
    >
      {letters || '?'}
    </span>
  );
}

function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const update = useUpdateMember();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const change = (body: { role?: OrgRole; isActive?: boolean }, done: string) =>
    update.mutate(
      { id: member.id, ...body },
      {
        onSuccess: () => {
          setConfirming(false);
          toast(done);
        },
        onError: (e) => {
          setConfirming(false);
          toast(messageOf(e), 'error');
        },
      },
    );

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-b border-white/[0.05] py-4 last:border-b-0 md:grid-cols-[auto_minmax(0,1fr)_150px_130px_130px]">
      <Initials name={member.name} muted={!member.isActive} />
      <div className="min-w-0">
        <p className={cx('truncate text-[15px] font-medium', member.isActive ? 'text-white' : 'text-subtle')}>
          {member.name}
          {isSelf && <span className="ml-2 text-[13px] font-normal text-subtle">You</span>}
        </p>
        <p className="truncate text-[13px] text-subtle">{member.email}</p>
      </div>
      <div className="col-span-2 md:col-span-1">
        {isSelf ? (
          <span className="text-[14px] text-white/60">{roleLabel(member.role)}</span>
        ) : (
          <Select
            label={`Role for ${member.name}`}
            hideLabel
            value={member.role}
            disabled={update.isPending || !member.isActive}
            onChange={(e) =>
              change(
                { role: e.target.value as OrgRole },
                `${member.name} is now ${e.target.value === 'ADMIN' ? 'an admin' : 'a member'}`,
              )
            }
            className="w-full"
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </Select>
        )}
      </div>
      <p className="col-span-2 text-[13px] text-subtle md:col-span-1">
        {!member.isActive ? (
          <span className="font-medium text-muted">Deactivated</span>
        ) : member.lastLoginAt ? (
          <>Active {relativeTime(member.lastLoginAt)}</>
        ) : (
          'Never logged in'
        )}
      </p>
      <div className="col-span-2 md:col-span-1 md:text-right">
        {!isSelf &&
          (member.isActive ? (
            <Button variant="ghost" onClick={() => setConfirming(true)} className="-ml-3 md:ml-0 md:-mr-3">
              Deactivate
            </Button>
          ) : (
            <Button
              variant="ghost"
              loading={update.isPending}
              onClick={() => change({ isActive: true }, `${member.name} can log in again`)}
              className="-ml-3 md:ml-0 md:-mr-3"
            >
              Reactivate
            </Button>
          ))}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Deactivate ${member.name}?`}
        confirmLabel="Deactivate"
        pending={update.isPending}
        onConfirm={() => change({ isActive: false }, `${member.name} is deactivated`)}
      >
        They are logged out everywhere at once and can't log in until an admin reactivates them. Their changes
        stay in the audit log.
      </ConfirmDialog>
    </li>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invite = useCreateInvite();
  const toast = useToast();
  const error = invite.error instanceof ApiError ? invite.error : null;
  const close = () => {
    invite.reset();
    onClose();
  };
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    invite.mutate(
      { email: formText(data, 'email').trim(), role: formText(data, 'role') as OrgRole },
      {
        onSuccess: (i) => {
          toast(`Invite sent to ${i.email}`);
          close();
        },
      },
    );
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title="Invite a Teammate"
      description="They get an email with a link to join. The link works once and expires in 48 hours."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="off"
          autoFocus
          required
          error={error?.code === 'EMAIL_TAKEN' ? error.message : error?.fieldError('email')}
        />
        <Select label="Role" name="role" defaultValue="MEMBER">
          <option value="MEMBER">Member: flags and end users</option>
          <option value="ADMIN">Admin: also team, audit log and settings</option>
        </Select>
        {error && error.code !== 'EMAIL_TAKEN' && error.code !== 'VALIDATION_ERROR' && (
          <FormError error={error} />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={invite.isPending}>
            Send invite
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Invites() {
  const invites = useInvites();
  const revoke = useRevokeInvite();
  const toast = useToast();

  if (invites.isPending) return <LoadingRows rows={2} label="Loading invites" />;
  if (invites.isError) return <ErrorState error={invites.error} onRetry={() => void invites.refetch()} />;

  const open = invites.data.filter((i) => i.status === 'PENDING' || i.status === 'EXPIRED');
  if (open.length === 0) {
    return (
      <p className="text-[14px] text-subtle">
        No open invites. Accepted and revoked ones drop off this list.
      </p>
    );
  }
  return (
    <ul>
      {open.map((i) => (
        <li
          key={i.id}
          className="flex flex-col gap-2 border-b border-white/[0.05] py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] text-white">{i.email}</p>
            <p className="text-[13px] text-subtle">
              {roleLabel(i.role)} ·{' '}
              {i.status === 'EXPIRED' ? (
                <span className="text-muted">Expired</span>
              ) : (
                <>
                  Expires <Time iso={i.expiresAt} />
                </>
              )}
            </p>
          </div>
          {i.status === 'PENDING' && (
            <Button
              variant="ghost"
              className="-ml-3 self-start sm:ml-0 sm:-mr-3 sm:self-auto"
              loading={revoke.isPending && revoke.variables === i.id}
              onClick={() =>
                revoke.mutate(i.id, {
                  onSuccess: () => toast(`Invite for ${i.email} revoked`),
                  onError: (e) => toast(messageOf(e), 'error'),
                })
              }
            >
              Revoke
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TeamPage() {
  const { user } = useAuth();
  const members = useMembers();
  const [inviting, setInviting] = useState(false);

  return (
    <>
      <PageHeader
        title="Team"
        description="Who can change flags in your organization. Admins also manage the team, the audit log and settings."
        actions={
          <Button onClick={() => setInviting(true)} icon={<MailPlus className="size-4" aria-hidden="true" />}>
            Invite
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <Panel title="Members" bodyClassName="px-5 py-1 sm:px-6">
          {members.isPending ? (
            <div className="py-4">
              <LoadingRows label="Loading members" />
            </div>
          ) : members.isError ? (
            <ErrorState error={members.error} onRetry={() => void members.refetch()} />
          ) : members.data.length === 0 ? (
            <EmptyState icon={Users} title="No Members" />
          ) : (
            <ul aria-label="Members">
              {members.data.map((m) => (
                <MemberRow key={m.id} member={m} isSelf={m.id === user?.id} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Open Invites" bodyClassName="px-5 py-3 sm:px-6">
          <Invites />
        </Panel>
      </div>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} />
    </>
  );
}
