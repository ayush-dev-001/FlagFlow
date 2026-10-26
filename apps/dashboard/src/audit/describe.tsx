import type { ReactNode } from 'react';
import type { AuditEntry } from '../api/queries';

type Meta = Record<string, unknown>;
const obj = (v: unknown): Meta => (v && typeof v === 'object' ? (v as Meta) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Things the log names that it only refers to by id. */
export interface AuditNames {
  /** Flag keys by flag id, for flags that still exist. */
  flags: Map<string, string>;
  /** Member names by user id. */
  people: Map<string, string>;
}

const Key = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-[0.92em] text-white">{children}</code>
);
const Strong = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-white">{children}</span>
);

const ids = (xs: string[]) => {
  const shown = xs.slice(0, 3).join(', ');
  return xs.length > 3 ? `${shown} and ${xs.length - 3} more` : shown;
};

/** One audit row as a plain sentence after the actor's name: "turned dark_mode on". */
export function describeEntry(entry: AuditEntry, names: AuditNames): ReactNode {
  const m = entry.metadata;
  const before = obj(m.before);
  const after = obj(m.after);
  const flagKey =
    str(after.key) ??
    str(before.key) ??
    (entry.flagId ? names.flags.get(entry.flagId) : undefined) ??
    'a flag';
  const flag = <Key>{flagKey}</Key>;
  const person = (id: unknown) => <Strong>{names.people.get(str(id) ?? '') ?? 'a member'}</Strong>;

  switch (entry.action) {
    case 'FLAG_CREATED':
      return <>created {flag}</>;
    case 'FLAG_TOGGLED':
      return (
        <>
          turned {flag} <Strong>{after.enabled ? 'on' : 'off'}</Strong>
        </>
      );
    case 'FLAG_UPDATED':
      if ('targetAll' in after) {
        return (
          <>
            set {flag} to reach <Strong>{after.targetAll ? 'all users' : 'listed users only'}</Strong>
          </>
        );
      }
      return <>edited the description of {flag}</>;
    case 'FLAG_TARGETS_CHANGED': {
      const added = list(m.added);
      const removed = list(m.removed);
      return (
        <>
          {added.length > 0 && (
            <>
              added <Key>{ids(added)}</Key> to {flag}
            </>
          )}
          {added.length > 0 && removed.length > 0 && ' and '}
          {removed.length > 0 && (
            <>
              removed <Key>{ids(removed)}</Key>
              {added.length === 0 && <> from {flag}</>}
            </>
          )}
        </>
      );
    }
    case 'FLAG_DELETED':
      return <>deleted {flag}</>;
    case 'ORG_CREATED':
      return <>created the organization</>;
    case 'ORG_UPDATED':
      return (
        <>
          renamed the organization to <Strong>{str(after.name)}</Strong>
        </>
      );
    case 'ORG_STATUS_CHANGED':
      return <>{after.isActive ? 'reactivated' : 'deactivated'} the organization</>;
    case 'MEMBER_INVITED':
      return (
        <>
          invited <Strong>{str(after.email)}</Strong> as {after.role === 'ADMIN' ? 'an admin' : 'a member'}
        </>
      );
    case 'INVITE_REVOKED':
      return <>revoked an invite</>;
    case 'INVITE_ACCEPTED':
      return <>joined as {m.role === 'ADMIN' ? 'an admin' : 'a member'}</>;
    case 'MEMBER_ROLE_CHANGED':
      return (
        <>
          made {person(m.userId)} {after.role === 'ADMIN' ? 'an admin' : 'a member'}
        </>
      );
    case 'MEMBER_DEACTIVATED':
      return <>deactivated {person(m.userId)}</>;
    case 'MEMBER_REACTIVATED':
      return <>reactivated {person(m.userId)}</>;
    case 'API_KEY_CREATED':
      return (
        <>
          created the API key <Strong>{str(after.name)}</Strong>
        </>
      );
    case 'API_KEY_REVOKED':
      return (
        <>
          revoked the API key <Strong>{str(before.name)}</Strong>
        </>
      );
    default:
      return <>{entry.action.toLowerCase().replaceAll('_', ' ')}</>;
  }
}
