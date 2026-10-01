import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http';
import { shouldRetry } from './retry';

describe('shouldRetry', () => {
  it('retries network and server errors a limited number of times', () => {
    expect(shouldRetry(0, new ApiError(0, 'Network error'))).toBe(true);
    expect(shouldRetry(1, new ApiError(500, 'boom'))).toBe(true);
    expect(shouldRetry(2, new ApiError(500, 'boom'))).toBe(false);
  });

  it('never retries a client error, so a missing item fails fast', () => {
    expect(shouldRetry(0, new ApiError(404, 'not found'))).toBe(false);
    expect(shouldRetry(0, new ApiError(400, 'bad'))).toBe(false);
  });
});
