const KEY = 'sc.tokens';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: Tokens): void {
  localStorage.setItem(KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(KEY);
}

/** Expiry time (ms since epoch) from a JWT's `exp` claim, or null if unreadable. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
