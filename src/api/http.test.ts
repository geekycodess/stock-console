import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTokens, setTokens } from '../auth/tokens';
import { memoryStorage } from '../test/memoryStorage';
import { http } from './http';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

describe('http token refresh', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.restoreAllMocks();
  });

  it('refreshes once when concurrent requests hit an expired token, then retries both', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'r1' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url, init) => {
        if (String(url).endsWith('/auth/refresh')) {
          return json(200, { accessToken: 'new', refreshToken: 'r2' });
        }
        const auth = (init?.headers as Record<string, string>).Authorization;
        return auth === 'Bearer new'
          ? json(200, { ok: true })
          : json(401, { message: 'Token Expired!' });
      });

    const [a, b] = await Promise.all([http('/a'), http('/b')]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    const refreshCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
    expect(getTokens()?.accessToken).toBe('new');
  });

  it('clears tokens and announces expiry when the refresh fails', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'dead' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/auth/refresh')
        ? json(401, { message: 'invalid' })
        : json(401, { message: 'Token Expired!' }),
    );
    const onExpired = vi.fn();
    window.addEventListener('auth:expired', onExpired);

    await expect(http('/a')).rejects.toMatchObject({ status: 401 });
    expect(getTokens()).toBeNull();
    expect(onExpired).toHaveBeenCalledOnce();
    window.removeEventListener('auth:expired', onExpired);
  });

  it('keeps the session when the refresh cannot reach the server', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'r1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/auth/refresh')) throw new TypeError('offline');
      return json(401, { message: 'Token Expired!' });
    });
    const onExpired = vi.fn();
    window.addEventListener('auth:expired', onExpired);

    await expect(http('/a')).rejects.toMatchObject({ status: 401 });
    expect(getTokens()).not.toBeNull(); // patchy wifi must not sign the user out
    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener('auth:expired', onExpired);
  });

  it('turns a failed fetch into an ApiError with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await expect(http('/a')).rejects.toMatchObject({ name: 'Error', status: 0 });
  });
});
