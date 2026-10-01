import { ApiError } from '../api/http';

/** Retry network and 5xx failures twice; a 4xx (bad id, bad input) will not fix itself. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500)
    return false;
  return failureCount < 2;
}

/** Short backoff so a hard failure reaches the error state (with its Retry button) in ~1.5s. */
export const retryDelay = (attempt: number): number => Math.min(500 * 2 ** attempt, 2000);
