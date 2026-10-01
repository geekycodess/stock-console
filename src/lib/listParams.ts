export const PAGE_SIZE = 20;

export const SORTS = {
  default: { label: 'Default order' },
  'title-asc': { label: 'Name, A to Z', sortBy: 'title', order: 'asc' },
  'title-desc': { label: 'Name, Z to A', sortBy: 'title', order: 'desc' },
  'stock-asc': { label: 'Stock, lowest first', sortBy: 'stock', order: 'asc' },
  'stock-desc': { label: 'Stock, highest first', sortBy: 'stock', order: 'desc' },
  'price-asc': { label: 'Price, lowest first', sortBy: 'price', order: 'asc' },
  'price-desc': { label: 'Price, highest first', sortBy: 'price', order: 'desc' },
} as const;

export type SortKey = keyof typeof SORTS;

export interface ListParams {
  q: string;
  category: string;
  sort: SortKey;
  page: number;
}

const isSortKey = (v: string | null): v is SortKey => v !== null && v in SORTS;

/** The URL is the source of truth, so anything in it may be garbage: sanitise. */
export function parseParams(sp: URLSearchParams): ListParams {
  const page = Number.parseInt(sp.get('page') ?? '1', 10);
  const sort = sp.get('sort');
  return {
    q: (sp.get('q') ?? '').trim(),
    category: sp.get('category') ?? '',
    sort: isSortKey(sort) ? sort : 'default',
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  };
}

/** Defaults are omitted so shared links stay short and canonical. */
export function toSearchParams(p: ListParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.category) sp.set('category', p.category);
  if (p.sort !== 'default') sp.set('sort', p.sort);
  if (p.page > 1) sp.set('page', String(p.page));
  return sp;
}

/** Nearest valid page for a result set; never below 1 even when there are no results. */
export function clampPage(page: number, total: number, pageSize = PAGE_SIZE): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)));
}
