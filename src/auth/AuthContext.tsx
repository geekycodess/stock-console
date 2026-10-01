import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  ApiError,
  AUTH_EXPIRED_EVENT,
  TOKEN_MINS,
  http,
  refreshSession,
} from '../api/http';
import { clearTokens, getTokens, setTokens, tokenExpiry, type Tokens } from './tokens';

interface User {
  id: number;
  firstName: string;
  lastName: string;
}
type Status = 'loading' | 'authed' | 'anon';

interface AuthValue {
  status: Status;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(getTokens() ? 'loading' : 'anon');
  const [user, setUser] = useState<User | null>(null);

  const drop = useCallback(() => {
    clearTokens();
    setUser(null);
    setStatus('anon');
  }, []);

  // Validate any stored session once; an expired access token is refreshed inside http().
  useEffect(() => {
    if (!getTokens()) return;
    http<User>('/auth/me')
      .then((u) => {
        setUser(u);
        setStatus('authed');
      })
      .catch((err: unknown) => {
        // Only a rejected token ends the session. Offline or a 5xx must not sign anyone out.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) drop();
        else setStatus('authed');
      });
  }, [drop]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, drop);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, drop);
  }, [drop]);

  // Refresh shortly before the access token expires so the session rolls over unnoticed.
  // A failed proactive refresh (e.g. patchy wifi) only retries; real sign-out is decided by http().
  useEffect(() => {
    if (status !== 'authed') return;
    let cancelled = false;
    let timer: number | undefined;
    const schedule = (fixedMs?: number) => {
      const token = getTokens()?.accessToken;
      const exp = token ? tokenExpiry(token) : null;
      const ms = fixedMs ?? Math.max((exp ? exp - Date.now() : 60_000) - 10_000, 5_000);
      timer = window.setTimeout(() => {
        void refreshSession().then((result) => {
          if (!cancelled) schedule(result === 'ok' ? undefined : 15_000);
        });
      }, ms);
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await http<Tokens & User>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, expiresInMins: TOKEN_MINS }),
      },
      false,
    );
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setUser(data);
    setStatus('authed');
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout: drop }),
    [status, user, login, drop],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
