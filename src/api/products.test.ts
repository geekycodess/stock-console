import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test/memoryStorage';
import { fetchList, fetchProduct, updateStock, type Product } from './products';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
const make = (id: number, category: string, stock = 50): Product => ({
  id,
  title: `Item ${id}`,
  category,
  price: 1,
  stock,
});
const signal = new AbortController().signal;
const urlOf = (m: { mock: { calls: unknown[][] } }, i = 0) =>
  String(m.mock.calls[i]?.[0]);

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.restoreAllMocks();
});

describe('fetchList', () => {
  it('combines search and category client-side, then paginates the filtered set', async () => {
    // DummyJSON cannot filter search by category: 50 matches, half in category "a".
    const all = Array.from({ length: 50 }, (_, i) =>
      make(i + 1, i % 2 === 0 ? 'a' : 'b'),
    );
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(200, { products: all, total: 50, skip: 0, limit: 0 }));

    const r = await fetchList(
      { q: 'x', category: 'a', sort: 'default', page: 2 },
      signal,
    );

    expect(urlOf(fetchMock)).toContain('limit=0');
    expect(r.total).toBe(25); // not 50: page count must follow the filtered set
    expect(r.products).toHaveLength(5); // 25 items, page size 20, so page 2 has 5
    expect(r.products.every((p) => p.category === 'a')).toBe(true);
  });

  it('uses server-side skip and sort when only a category is set', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(json(200, { products: [], total: 0, skip: 40, limit: 20 }));

    await fetchList({ q: '', category: 'beauty', sort: 'stock-asc', page: 3 }, signal);

    const url = urlOf(fetchMock);
    expect(url).toContain('/products/category/beauty?');
    expect(url).toContain('limit=20&skip=40');
    expect(url).toContain('sortBy=stock&order=asc');
  });
});

describe('stock correction', () => {
  it('overlays a confirmed correction on later reads, because the API does not persist it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json(200, make(7, 'a', 50)),
    ); // server always answers with the old stock, like DummyJSON

    const saved = await updateStock(7, 3);
    expect(saved.stock).toBe(3);
    expect((await fetchProduct('7', signal)).stock).toBe(3);
  });

  it('records nothing when the PUT fails, so the UI never shows an unsaved count', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
      init?.method === 'PUT'
        ? json(500, { message: 'boom' })
        : json(200, make(7, 'a', 50)),
    );

    await expect(updateStock(7, 3)).rejects.toMatchObject({ status: 500 });
    expect((await fetchProduct('7', signal)).stock).toBe(50);
  });
});
