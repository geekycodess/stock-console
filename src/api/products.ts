import { PAGE_SIZE, SORTS, type ListParams } from '../lib/listParams';
import { http } from './http';

export interface Product {
  id: number;
  title: string;
  description?: string;
  category: string;
  price: number;
  stock: number;
  sku?: string;
  brand?: string;
  thumbnail?: string;
}
export interface ProductPage {
  products: Product[];
  total: number;
}
export interface Category {
  slug: string;
  name: string;
}

/*
 * DummyJSON's PUT is simulated: it echoes the update but never persists it, so a
 * later GET returns the old stock. We remember confirmed corrections locally and
 * overlay them on reads so the console behaves like a real backend would.
 */
const OVERRIDES_KEY = 'sc.stockOverrides';
const readOverrides = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}') as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
};
const withOverride = (p: Product): Product => {
  const o = readOverrides()[p.id];
  return o === undefined ? p : { ...p, stock: o };
};

const FIELDS = 'id,title,category,price,stock,thumbnail,sku,brand';

export async function fetchList(
  p: ListParams,
  signal: AbortSignal,
): Promise<ProductPage> {
  const s: { label: string; sortBy?: string; order?: string } = SORTS[p.sort];
  const sort = s.sortBy ? `&sortBy=${s.sortBy}&order=${s.order}` : '';
  const skip = (p.page - 1) * PAGE_SIZE;
  const q = encodeURIComponent(p.q);

  // The API cannot combine search with a category filter: fetch all matches, filter here.
  if (p.q && p.category) {
    const r = await http<ProductPage>(
      `/products/search?q=${q}&limit=0&select=${FIELDS}${sort}`,
      {
        signal,
      },
    );
    const all = r.products.filter((x) => x.category === p.category);
    return {
      products: all.slice(skip, skip + PAGE_SIZE).map(withOverride),
      total: all.length,
    };
  }

  const base = p.q
    ? `/products/search?q=${q}&`
    : p.category
      ? `/products/category/${encodeURIComponent(p.category)}?`
      : '/products?';
  const r = await http<ProductPage>(
    `${base}limit=${PAGE_SIZE}&skip=${skip}&select=${FIELDS}${sort}`,
    { signal },
  );
  return { ...r, products: r.products.map(withOverride) };
}

export const fetchProduct = async (id: string, signal: AbortSignal): Promise<Product> =>
  withOverride(await http<Product>(`/products/${encodeURIComponent(id)}`, { signal }));

export const fetchCategories = (signal: AbortSignal) =>
  http<Category[]>('/products/categories', { signal });

export async function updateStock(id: number, stock: number): Promise<Product> {
  const res = await http<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ stock }),
  });
  localStorage.setItem(
    OVERRIDES_KEY,
    JSON.stringify({ ...readOverrides(), [id]: stock }),
  );
  return { ...res, stock };
}
