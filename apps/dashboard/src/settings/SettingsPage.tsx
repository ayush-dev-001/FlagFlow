import { KeyRound, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ApiError } from '../api/client';
import {
  type ApiKey,
  useApiKeys,
  useCreateApiKey,
  useOrg,
  useRenameOrg,
  useRevokeApiKey,
} from '../api/queries';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../shell/PageHeader';
import {
  Checkbox,
  ConfirmDialog,
  CopyButton,
  Dialog,
  EmptyState,
  ErrorState,
  FormError,
  LoadingRows,
  messageOf,
  Panel,
  Time,
} from '../ui/kit';
import { formText } from '../ui/form';
import { Button, cx, Field } from '../ui/primitives';
import { useToast } from '../ui/toast';

function OrganizationPanel() {
  const org = useOrg();
  const rename = useRenameOrg();
  const { setOrganizationName } = useAuth();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);

  if (org.isPending)
    return (
      <Panel title="Organization">
        <LoadingRows rows={2} label="Loading organization" />
      </Panel>
    );
  if (org.isError)
    return (
      <Panel title="Organization">
        <ErrorState error={org.error} onRetry={() => void org.refetch()} />
      </Panel>
    );

  const value = name ?? org.data.name;
  const changed = value.trim() !== org.data.name;
  const fieldError = rename.error instanceof ApiError ? rename.error.fieldError('name') : undefined;

  return (
    <Panel title="Organization">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          rename.mutate(value.trim(), {
            onSuccess: (o) => {
              setOrganizationName(o.name);
              setName(null);
              toast('Organization renamed');
            },
          });
        }}
        className="flex flex-col gap-4"
      >
        <Field
          label="Name"
          value={value}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          error={fieldError}
        />
        <p className="text-[13px] text-subtle">
          ID <code className="font-mono text-white/70">{org.data.slug}</code>. It never changes, so renaming
          is safe.
        </p>
        {!fieldError && <FormError error={rename.error} />}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            disabled={!changed || value.trim().length < 2}
            loading={rename.isPending}
          >
            Save
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function NewKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateApiKey();
  const [stored, setStored] = useState(false);
  const created = create.data;
  const close = () => {
    create.reset();
    setStored(false);
    onClose();
  };

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    create.mutate(formText(new FormData(e.currentTarget), 'name').trim());
  }

  if (created) {
    return (
      <Dialog
        open={open}
        onClose={() => stored && close()}
        title="Copy Your New Key"
        description="FlagFlow stores only a hash of it and can't show it again."
        wide
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <code
            aria-label="API key"
            className="min-w-0 flex-1 rounded-control border border-white/10 bg-ink/70 px-3.5 py-3 font-mono text-[14px] leading-relaxed break-all text-lime select-all"
          >
            {created.key}
          </code>
          <CopyButton value={created.key} />
        </div>
        <p className="mt-4 text-[14px] text-white/55">
          Put it in your backend's environment. Never ship it to a browser.
        </p>
        <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Checkbox checked={stored} onChange={setStored}>
            I've stored this key somewhere safe
          </Checkbox>
          <Button onClick={close} disabled={!stored}>
            Done
          </Button>
        </div>
      </Dialog>
    );
  }

  const error = create.error instanceof ApiError ? create.error : null;
  return (
    <Dialog
      open={open}
      onClose={close}
      title="New API Key"
      description="Name it after where it will be used."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field
          label="Name"
          name="name"
          autoComplete="off"
          autoFocus
          required
          maxLength={60}
          placeholder="Production backend"
          error={error?.fieldError('name')}
        />
        {error && error.code !== 'VALIDATION_ERROR' && <FormError error={error} />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create key
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const revoke = useRevokeApiKey();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const revoked = apiKey.revokedAt !== null;
  return (
    <li className="flex flex-col gap-2 border-b border-white/[0.05] py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-[15px] font-medium', revoked ? 'text-subtle' : 'text-white')}>
          {apiKey.name}
        </p>
        <p className="font-mono text-[13px] text-subtle">{apiKey.prefix}…</p>
      </div>
      <p className="text-[13px] text-subtle sm:w-44">
        {revoked ? (
          <span className="text-muted">
            Revoked <Time iso={apiKey.revokedAt!} />
          </span>
        ) : apiKey.lastUsedAt ? (
          <>
            Used <Time iso={apiKey.lastUsedAt} />
          </>
        ) : (
          'Never used'
        )}
      </p>
      <p className="text-[13px] text-subtle sm:w-36">
        Created <Time iso={apiKey.createdAt} />
      </p>
      <div className="sm:w-24 sm:text-right">
        {!revoked && (
          <Button variant="ghost" onClick={() => setConfirming(true)} className="-ml-3 sm:ml-0 sm:-mr-3">
            Revoke
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Revoke ${apiKey.name}?`}
        confirmLabel="Revoke key"
        pending={revoke.isPending}
        onConfirm={() =>
          revoke.mutate(apiKey.id, {
            onSuccess: () => {
              setConfirming(false);
              toast(`${apiKey.name} revoked`);
            },
            onError: (e) => {
              setConfirming(false);
              toast(messageOf(e), 'error');
            },
          })
        }
      >
        Apps using it are refused on their next request and their live streams close at once. This can't be
        undone.
      </ConfirmDialog>
    </li>
  );
}

function ApiKeysPanel() {
  const keys = useApiKeys();
  const [creating, setCreating] = useState(false);
  return (
    <Panel
      title="API Keys"
      description="Your backends use these to read flags. Keep one per app or environment, so you can revoke one alone."
      actions={
        <Button
          variant="secondary"
          onClick={() => setCreating(true)}
          icon={<Plus className="size-4" aria-hidden="true" />}
        >
          New key
        </Button>
      }
      bodyClassName="px-5 py-1 sm:px-6"
    >
      {keys.isPending ? (
        <div className="py-4">
          <LoadingRows rows={2} label="Loading API keys" />
        </div>
      ) : keys.isError ? (
        <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />
      ) : keys.data.length === 0 ? (
        <EmptyState icon={KeyRound} title="No API Keys">
          Create one so your backend can read flags.
        </EmptyState>
      ) : (
        <ul aria-label="API keys">
          {keys.data.map((k) => (
            <KeyRow key={k.id} apiKey={k} />
          ))}
        </ul>
      )}
      <NewKeyDialog open={creating} onClose={() => setCreating(false)} />
    </Panel>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your organization's name and the API keys your apps use." />
      <div className="flex flex-col gap-4">
        <OrganizationPanel />
        <ApiKeysPanel />
      </div>
    </>
  );
}
