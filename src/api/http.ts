import { clearTokens, getTokens, setTokens, type Tokens } from '../auth/tokens';

export const BASE_URL = 'https://dummyjson.com';
export const AUTH_EXPIRED_EVENT = 'auth:expired';

/** Access-token lifetime in minutes. Defaults to 1 so expiry shows up while testing; use 30 for real use. */
export const TOKEN_MINS = Number(import.meta.env.VITE_TOKEN_MINS ?? 1);

// Dev-only switches (see .env.example) to test slow networks and server errors without editing code.
const DEV_DELAY = import.meta.env.DEV ? Number(import.meta.env.VITE_API_DELAY ?? 0) : 0;
const DEV_FORCE_ERROR = import.meta.env.DEV
  ? String(import.meta.env.VITE_FORCE_ERROR ?? '')
  : '';

function applyDevFlags(path: string): string {
  // Auth calls are exempt from forced errors so sign-in keeps working.
  if (DEV_FORCE_ERROR && path.startsWith('/products')) return `/http/${DEV_FORCE_ERROR}`;
  if (DEV_DELAY > 0) return `${path}${path.includes('?') ? '&' : '?'}delay=${DEV_DELAY}`;
  return path;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type RefreshResult = 'ok' | 'invalid' | 'unreachable';

// One refresh at a time: concurrent 401s share the same in-flight refresh.
let refreshing: Promise<RefreshResult> | null = null;

/**
 * 'invalid' = the server rejected the refresh token, so the session is really over.
 * 'unreachable' = network or 5xx trouble: keep the session, because on patchy wifi
 * signing someone out (and losing their place) for a dropped request is the worse failure.
 */
async function refreshTokens(): Promise<RefreshResult> {
  const tokens = getTokens();
  if (!tokens) return 'invalid';
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: tokens.refreshToken,
        expiresInMins: TOKEN_MINS,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as Tokens;
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return 'ok';
    }
    if (res.status >= 400 && res.status < 500) {
      clearTokens();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      return 'invalid';
    }
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= refreshTokens().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function http<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const tokens = getTokens();
  const headers: Record<string, string> = {};
  if (init.body) headers['Content-Type'] = 'application/json';
  if (tokens && !path.startsWith('/auth/login')) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${applyDevFlags(path)}`, { ...init, headers });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err; // cancelled, not failed
    throw new ApiError(0, 'Network error');
  }

  if (res.status === 401 && retry && tokens) {
    if ((await refreshSession()) === 'ok') return http<T>(path, init, false);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(res.status, body?.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}
