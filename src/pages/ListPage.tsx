import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { fetchCategories, fetchList } from '../api/products';
import { StockBadge } from '../components/StockBadge';
import { Empty, ErrorState, ListSkeleton, Loading } from '../components/States';
import { formatPrice, prettyCategory, stockLevel } from '../lib/format';
import {
  SORTS,
  clampPage,
  parseParams,
  toSearchParams,
  type ListParams,
  type SortKey,
} from '../lib/listParams';

export function ListPage() {
  const [sp, setSp] = useSearchParams();
  const params = parseParams(sp);
  const { search } = useLocation();

  const update = useCallback(
    (patch: Partial<ListParams>, replace = false) =>
      setSp((prev) => toSearchParams({ ...parseParams(prev), page: 1, ...patch }), {
        replace,
      }),
    [setSp],
  );

  // Search box: local text for instant typing, debounced into the URL.
  const [text, setText] = useState(params.q);
  const pushed = useRef(params.q);
  useEffect(() => {
    if (params.q !== pushed.current) {
      pushed.current = params.q; // changed by back/forward, not by typing
      setText(params.q);
    }
  }, [params.q]);
  useEffect(() => {
    const next = text.trim();
    if (next === pushed.current) return;
    const id = setTimeout(() => {
      pushed.current = next;
      update({ q: next }, true);
    }, 300);
    return () => clearTimeout(id);
  }, [text, update]);

  // No keepPreviousData on purpose: never show results for a query that was replaced.
  const list = useQuery({
    queryKey: ['products', 'list', params],
    queryFn: ({ signal }) => fetchList(params, signal),
    staleTime: 60_000,
  });
  const cats = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: Infinity,
  });

  // A shrunk result set (or a hand-edited URL) must not leave the user on an empty page.
  const data = list.data;
  useEffect(() => {
    if (!data) return;
    const page = clampPage(params.page, data.total);
    if (page !== params.page) update({ page }, true);
  }, [data, params.page, update]);

  // After paging, return to the top and put keyboard focus on the first item of the new page.
  const listRef = useRef<HTMLTableElement>(null);
  const focusAfterPaging = useRef(false);
  const goToPage = (page: number) => {
    focusAfterPaging.current = true;
    update({ page });
  };
  // While the next page loads the pager is gone, so keep focus on the loading message instead
  // of letting it fall back to the top of the document.
  const loadingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusAfterPaging.current && list.isPending) loadingRef.current?.focus();
    if (list.isError) focusAfterPaging.current = false;
  }, [list.isPending, list.isError]);
  useEffect(() => {
    if (!focusAfterPaging.current || !data || data.products.length === 0) return;
    focusAfterPaging.current = false;
    window.scrollTo({ top: 0 });
    listRef.current?.querySelector('a')?.focus();
  }, [data]);

  const pages = data ? clampPage(Number.MAX_SAFE_INTEGER, data.total) : 1;

  const filtersActive = Boolean(params.q || params.category || params.sort !== 'default');

  return (
    <>
      <div className="page-head">
        <h1>Stock</h1>
        <p className="muted">Search, filter and open an item to correct its count.</p>
      </div>
      <form role="search" className="card controls" onSubmit={(e) => e.preventDefault()}>
        <label>
          Search
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Item name"
          />
        </label>
        <label>
          Category
          <select
            value={params.category}
            onChange={(e) => update({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {cats.data?.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
            {params.category && !cats.data?.some((c) => c.slug === params.category) && (
              <option value={params.category}>{prettyCategory(params.category)}</option>
            )}
          </select>
        </label>
        <label>
          Sort by
          <select
            value={params.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      {cats.isError && (
        <p role="alert" className="field-error">
          Categories could not be loaded, so the category filter is unavailable.{' '}
          <button type="button" onClick={() => void cats.refetch()}>
            Retry
          </button>
        </p>
      )}

      {list.isPending && (
        <div ref={loadingRef} tabIndex={-1} className="focus-quiet">
          <ListSkeleton />
        </div>
      )}
      {list.isError && (
        <ErrorState
          message="Stock could not be loaded. Check your connection and try again."
          onRetry={() => void list.refetch()}
        />
      )}
      {data && data.total === 0 && (
        <Empty>
          <p>No items match these filters.</p>
          <button type="button" className="primary" onClick={() => setSp({})}>
            Clear search and filters
          </button>
        </Empty>
      )}
      {data && data.total > 0 && data.products.length === 0 && <Loading />}
      {data && data.products.length > 0 && (
        <>
          <div className="result-bar">
            <p role="status">
              {data.total} items, page {params.page} of {pages}
            </p>
            {filtersActive && (
              <button type="button" onClick={() => setSp({})}>
                Clear filters
              </button>
            )}
          </div>
          <div className="table-wrap card">
            {/* On phones the CSS turns rows into cards; table/row roles keep the semantics for screen readers. */}
            <table className="stock-table" ref={listRef} role="table">
              <caption className="sr-only">Stock items</caption>
              <thead>
                <tr role="row">
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col" className="num">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id} role="row" data-level={stockLevel(p.stock)}>
                    <td className="cell-item">
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt=""
                          width="48"
                          height="48"
                          loading="lazy"
                        />
                      ) : (
                        <span className="img-fallback" aria-hidden="true" />
                      )}
                      <span className="item-main">
                        <Link
                          to={`/items/${p.id}`}
                          state={{ search }}
                          className="row-link"
                        >
                          {p.title}
                        </Link>
                        {p.sku && <span className="muted">SKU {p.sku}</span>}
                      </span>
                    </td>
                    <td className="cell-cat">{prettyCategory(p.category)}</td>
                    <td className="num cell-price">{formatPrice(p.price)}</td>
                    <td className="num cell-stock">
                      <StockBadge stock={p.stock} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Pagination" className="pager">
            <button
              type="button"
              disabled={params.page <= 1}
              onClick={() => goToPage(params.page - 1)}
            >
              Previous
            </button>
            <span>
              Page {params.page} of {pages}
            </span>
            <button
              type="button"
              disabled={params.page >= pages}
              onClick={() => goToPage(params.page + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </>
  );
}
