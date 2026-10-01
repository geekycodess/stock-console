import { describe, expect, it } from 'vitest';
import { prettyCategory, stockLevel } from './format';

describe('stockLevel', () => {
  it('separates out-of-stock from low stock at the boundary', () => {
    expect(stockLevel(0)).toBe('out');
    expect(stockLevel(-3)).toBe('out');
    expect(stockLevel(1)).toBe('low');
    expect(stockLevel(9)).toBe('low');
    expect(stockLevel(10)).toBe('ok');
  });
});

describe('prettyCategory', () => {
  it('turns slugs into readable labels', () => {
    expect(prettyCategory('mens-shirts')).toBe('Mens shirts');
    expect(prettyCategory('')).toBe('');
  });
});
