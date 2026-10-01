import { describe, expect, it } from 'vitest';
import { clampPage, parseParams, toSearchParams } from './listParams';

describe('listParams', () => {
  it('round-trips state through the URL and omits defaults', () => {
    const p = { q: 'gauze', category: 'beauty', sort: 'stock-asc' as const, page: 3 };
    expect(parseParams(toSearchParams(p))).toEqual(p);
    expect(
      toSearchParams({ q: '', category: '', sort: 'default', page: 1 }).toString(),
    ).toBe('');
  });

  it('sanitises a hand-edited or stale URL', () => {
    const p = parseParams(new URLSearchParams('page=-4&sort=nonsense&q=%20x%20'));
    expect(p).toEqual({ q: 'x', category: '', sort: 'default', page: 1 });
    expect(parseParams(new URLSearchParams('page=abc')).page).toBe(1);
  });

  it('clamps a page that no longer exists after the result set shrinks', () => {
    expect(clampPage(9, 45)).toBe(3);
    expect(clampPage(2, 0)).toBe(1);
    expect(clampPage(0, 100)).toBe(1);
  });
});
