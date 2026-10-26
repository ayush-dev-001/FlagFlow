// Typed hooks over the dashboard API (PLAN.md §2). Every mutation updates or invalidates the queries it
// affects, so a change shows up everywhere it appears without a reload.
import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './client';

export type BoardState = 'inactive' | 'testing' | 'live';
export type OrgRole = 'ADMIN' | 'MEMBER';

interface Person {
  id: string;
  name: string;
}

export interface FlagSummary {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  targetAll: boolean;
  state: BoardState;
  version: number;
  targetCount: number;
  createdBy: Person | null;
  updatedBy: Person | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlagDetail extends FlagSummary {
  targets: string[];
}

export interface EndUserFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  targeted: boolean;
  flagEnabled: boolean;
  targetAll: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  flagId: string | null;
  actor: { id: string; name: string; email: string } | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | OrgRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Invite {
  id: string;
  email: string;
  role: OrgRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  members: number;
  flags: number;
  activeApiKeys: number;
  createdAt: string;
}

const enc = encodeURIComponent;

export const keys = {
  flags: ['flags'] as const,
  flagList: (search: string) => ['flags', 'list', search] as const,
  flag: (id: string) => ['flags', 'detail', id] as const,
  connections: ['flags', 'connections'] as const,
  endUser: (id: string) => ['end-users', id] as const,
  audit: (filters: { flagId?: string; actorId?: string }) => ['audit', filters] as const,
  members: ['team', 'members'] as const,
  invites: ['team', 'invites'] as const,
  org: ['org'] as const,
  apiKeys: ['org', 'api-keys'] as const,
  organizations: ['admin', 'organizations'] as const,
};

// ---- Flags ----

export function useFlags(search: string) {
  return useQuery({
    queryKey: keys.flagList(search),
    queryFn: () =>
      api<{ flags: FlagSummary[] }>(`/flags${search ? `?search=${enc(search)}` : ''}`).then((r) => r.flags),
    placeholderData: (prev) => prev,
    // Teammates change flags too: keep the board current while it is open.
    refetchInterval: 20_000,
  });
}

export function useFlag(id: string) {
  return useQuery({
    queryKey: keys.flag(id),
    queryFn: () => api<{ flag: FlagDetail }>(`/flags/${enc(id)}`).then((r) => r.flag),
    refetchInterval: 20_000,
  });
}

export function useConnections() {
  return useQuery({
    queryKey: keys.connections,
    queryFn: () => api<{ connectedClients: number }>('/flags/connections').then((r) => r.connectedClients),
    refetchInterval: 10_000,
  });
}

/** After any flag change: put the fresh flag in its detail cache and refresh lists that show it. */
function flagChanged(qc: QueryClient, flag: FlagDetail) {
  qc.setQueryData(keys.flag(flag.id), flag);
  void qc.invalidateQueries({ queryKey: keys.flags, predicate: (q) => q.queryKey[1] === 'list' });
  void qc.invalidateQueries({ queryKey: ['end-users'] });
  void qc.invalidateQueries({ queryKey: ['audit'] });
}

const stateOf = (f: { enabled: boolean; targetAll: boolean }): BoardState =>
  !f.enabled ? 'inactive' : f.targetAll ? 'live' : 'testing';

export function useToggleFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ flag: FlagDetail }>(`/flags/${enc(id)}/toggle`, { method: 'POST' }).then((r) => r.flag),
    // Optimistic: the switch and the board column move at once; a failure puts them back.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.flags });
      const lists = qc.getQueriesData<FlagSummary[]>({
        queryKey: keys.flags,
        predicate: (q) => q.queryKey[1] === 'list',
      });
      const flip = <T extends FlagSummary>(f: T): T =>
        f.id === id ? { ...f, enabled: !f.enabled, state: stateOf({ ...f, enabled: !f.enabled }) } : f;
      for (const [key, data] of lists) if (data) qc.setQueryData(key, data.map(flip));
      const detail = qc.getQueryData<FlagDetail>(keys.flag(id));
      if (detail) qc.setQueryData(keys.flag(id), flip(detail));
      return { lists, detail };
    },
    onError: (_err, id, ctx) => {
      for (const [key, data] of ctx?.lists ?? []) qc.setQueryData(key, data);
      if (ctx?.detail) qc.setQueryData(keys.flag(id), ctx.detail);
    },
    onSuccess: (flag) => flagChanged(qc, flag),
  });
}

export function useCreateFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; description: string; targetAll: boolean; targets: string[] }) =>
      api<{ flag: FlagDetail }>('/flags', { method: 'POST', body }).then((r) => r.flag),
    onSuccess: (flag) => flagChanged(qc, flag),
  });
}

export function useUpdateFlag(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { description?: string; targetAll?: boolean }) =>
      api<{ flag: FlagDetail }>(`/flags/${enc(id)}`, { method: 'PATCH', body }).then((r) => r.flag),
    onSuccess: (flag) => flagChanged(qc, flag),
  });
}

export function useChangeTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, add = [], remove = [] }: { id: string; add?: string[]; remove?: string[] }) =>
      api<{ flag: FlagDetail }>(`/flags/${enc(id)}/targets`, { method: 'POST', body: { add, remove } }).then(
        (r) => r.flag,
      ),
    onSuccess: (flag) => flagChanged(qc, flag),
  });
}

export function useDeleteFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/flags/${enc(id)}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.flag(id) });
      void qc.invalidateQueries({ queryKey: keys.flags });
      void qc.invalidateQueries({ queryKey: ['end-users'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useEndUser(id: string) {
  return useQuery({
    queryKey: keys.endUser(id),
    queryFn: () =>
      api<{ endUserId: string; flags: EndUserFlag[] }>(`/end-users/${enc(id)}/flags`).then((r) => r.flags),
    enabled: id !== '',
    retry: false,
  });
}

// ---- Audit ----

export function useAudit(filters: { flagId?: string; actorId?: string }, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.audit(filters),
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams({ limit: '30' });
      if (filters.flagId) q.set('flagId', filters.flagId);
      if (filters.actorId) q.set('actorId', filters.actorId);
      if (pageParam) q.set('cursor', pageParam);
      return api<{ entries: AuditEntry[]; nextCursor: string | null }>(`/audit-logs?${q.toString()}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  });
}

// ---- Team ----

export function useMembers() {
  return useQuery({
    queryKey: keys.members,
    queryFn: () => api<{ members: Member[] }>('/team/members').then((r) => r.members),
  });
}

export function useInvites(enabled = true) {
  return useQuery({
    queryKey: keys.invites,
    queryFn: () => api<{ invites: Invite[] }>('/team/invites').then((r) => r.invites),
    enabled,
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: OrgRole; isActive?: boolean }) =>
      api<{ member: Member }>(`/team/members/${enc(id)}`, { method: 'PATCH', body }).then((r) => r.member),
    onSuccess: (member) => {
      qc.setQueryData<Member[]>(keys.members, (list) => list?.map((m) => (m.id === member.id ? member : m)));
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: OrgRole }) =>
      api<{ invite: Invite }>('/team/invites', { method: 'POST', body }).then((r) => r.invite),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.invites });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/team/invites/${enc(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.invites });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

// ---- Organization ----

export function useOrg() {
  return useQuery({
    queryKey: keys.org,
    queryFn: () =>
      api<{ organization: { id: string; name: string; slug: string } }>('/org').then((r) => r.organization),
  });
}

export function useRenameOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ organization: { id: string; name: string; slug: string } }>('/org', {
        method: 'PATCH',
        body: { name },
      }).then((r) => r.organization),
    onSuccess: (org) => {
      qc.setQueryData(keys.org, org);
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: keys.apiKeys,
    queryFn: () => api<{ apiKeys: ApiKey[] }>('/org/api-keys').then((r) => r.apiKeys),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ apiKey: ApiKey & { key: string } }>('/org/api-keys', { method: 'POST', body: { name } }).then(
        (r) => r.apiKey,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.apiKeys });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/org/api-keys/${enc(id)}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.apiKeys });
      void qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

// ---- Superadmin ----

export function useOrganizations() {
  return useQuery({
    queryKey: keys.organizations,
    queryFn: () =>
      api<{ organizations: OrganizationSummary[] }>('/admin/organizations').then((r) => r.organizations),
  });
}

export function useSetOrgActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api<{ organization: OrganizationSummary }>(`/admin/organizations/${enc(id)}`, {
        method: 'PATCH',
        body: { isActive },
      }).then((r) => r.organization),
    onSuccess: (org) =>
      qc.setQueryData<OrganizationSummary[]>(keys.organizations, (list) =>
        list?.map((o) => (o.id === org.id ? org : o)),
      ),
  });
}
