// Talks to the FlagFlow API. The access token lives only in memory (never in storage), and the
// refresh token is an httpOnly cookie the browser sends to /api/auth only. A 401 triggers one silent
// refresh and a single retry; concurrent requests share that one refresh.

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The message for one field from a VALIDATION_ERROR, if the server sent one. */
  fieldError(field: string): string | undefined {
    if (!Array.isArray(this.details)) return undefined;
    const hit = (this.details as { path?: string; message?: string }[]).find((d) => d.path === field);
    return hit?.message;
  }
}

// A non-secret hint that this browser had a session, so a guest's first visit doesn't fire a refresh that
// can only 401. It holds no token; the httpOnly cookie stays the only credential.
const SESSION_HINT = 'ff_had_session';

function setSessionHint(on: boolean) {
  try {
    if (on) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    // storage unavailable: refresh is simply attempted every time
  }
}

export function mightHaveSession(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT) !== null;
  } catch {
    return true;
  }
}

let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

/** Called by the auth provider so a failed silent refresh can drop the user back to the login page. */
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

export function setAccessToken(token: string | null, expiresIn?: number) {
  accessToken = token;
  setSessionHint(token !== null);
  clearTimeout(refreshTimer);
  // Refresh a minute before expiry so a user mid-task never sees a 401 at all.
  if (token && expiresIn && expiresIn > 90) {
    refreshTimer = setTimeout(() => void refreshSession(), (expiresIn - 60) * 1000);
  }
}

export function hasSession() {
  return accessToken !== null;
}

async function parse(res: Response) {
  if (res.status === 204) return undefined;
  const text = await res.text();
  return text ? (JSON.parse(text) as unknown) : undefined;
}

function toError(res: Response, body: unknown) {
  const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | undefined)?.error;
  return new ApiError(
    res.status,
    err?.code ?? 'HTTP_ERROR',
    err?.message ?? `Request failed (${res.status})`,
    err?.details,
  );
}

/** Exchanges the refresh cookie for a new access token. Resolves false when there is no valid session. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-requested-with': 'fetch' },
      });
      if (!res.ok) {
        setAccessToken(null);
        return false;
      }
      const body = (await res.json()) as { accessToken: string; expiresIn: number };
      setAccessToken(body.accessToken, body.expiresIn);
      return true;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token and refresh once on 401 (default true). */
  auth?: boolean;
}

export async function api<T>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions = {},
): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...(auth && accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach FlagFlow. Check your connection and try again.');
  }

  if (res.status === 401 && auth) {
    if (await refreshSession()) {
      res = await send();
    } else {
      onSessionLost?.();
    }
  }

  const parsed = await parse(res);
  if (!res.ok) throw toError(res, parsed);
  return parsed as T;
}
