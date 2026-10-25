import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, mightHaveSession, refreshSession, setAccessToken, setSessionLostHandler } from '../api/client';

export type Role = 'SUPERADMIN' | 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface NewApiKey {
  id: string;
  name: string;
  prefix: string;
  key: string;
}

interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  user: User;
  organization: Organization | null;
}

type Status = 'loading' | 'authed' | 'guest';

interface AuthContextValue {
  status: Status;
  user: User | null;
  organization: Organization | null;
  /** The first API key from registration, held in memory only until the user confirms they stored it. */
  newApiKey: NewApiKey | null;
  dismissNewApiKey: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
  }) => Promise<void>;
  acceptInvite: (token: string, input: { name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Without a session hint there is nothing to restore, so guests render on the first frame
  // instead of flashing the loading screen.
  const [status, setStatus] = useState<Status>(() => (mightHaveSession() ? 'loading' : 'guest'));
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [newApiKey, setNewApiKey] = useState<NewApiKey | null>(null);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setOrganization(null);
    setNewApiKey(null);
    queryClient.clear();
    setStatus('guest');
  }, [queryClient]);

  const adopt = useCallback((session: SessionResponse) => {
    setAccessToken(session.accessToken, session.expiresIn);
    setUser(session.user);
    setOrganization(session.organization);
    setStatus('authed');
  }, []);

  // Restore the session on load from the refresh cookie, silently.
  useEffect(() => {
    setSessionLostHandler(clear);
    let cancelled = false;
    void (async () => {
      if (!mightHaveSession() || !(await refreshSession())) {
        if (!cancelled) setStatus('guest');
        return;
      }
      try {
        const me = await api<{ user: User; organization: Organization | null }>('/auth/me');
        if (cancelled) return;
        setUser(me.user);
        setOrganization(me.organization);
        setStatus('authed');
      } catch {
        if (!cancelled) clear();
      }
    })();
    return () => {
      cancelled = true;
      setSessionLostHandler(null);
    };
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      organization,
      newApiKey,
      dismissNewApiKey: () => setNewApiKey(null),
      async login(email, password) {
        adopt(
          await api<SessionResponse>('/auth/login', {
            method: 'POST',
            body: { email, password },
            auth: false,
          }),
        );
      },
      async register(input) {
        const res = await api<SessionResponse & { apiKey: NewApiKey }>('/auth/register', {
          method: 'POST',
          body: input,
          auth: false,
        });
        setNewApiKey(res.apiKey);
        adopt(res);
      },
      async acceptInvite(token, input) {
        adopt(
          await api<SessionResponse>(`/auth/invites/${encodeURIComponent(token)}/accept`, {
            method: 'POST',
            body: input,
            auth: false,
          }),
        );
      },
      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' });
        } finally {
          clear();
        }
      },
    }),
    [status, user, organization, newApiKey, adopt, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
