import { describe, expect, it } from 'vitest';
import { tokenExpiry } from './tokens';

const b64url = (o: object) =>
  btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

describe('tokenExpiry', () => {
  it('reads exp from a JWT payload in milliseconds', () => {
    expect(tokenExpiry(`h.${b64url({ exp: 1700000000 })}.s`)).toBe(1700000000000);
  });

  it('returns null for anything that is not a readable JWT', () => {
    expect(tokenExpiry('garbage')).toBeNull();
    expect(tokenExpiry(`h.${b64url({ sub: 1 })}.s`)).toBeNull();
  });
});
