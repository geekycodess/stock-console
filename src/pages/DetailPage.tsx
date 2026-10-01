import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError } from '../api/http';
import { fetchProduct, updateStock, type Product } from '../api/products';
import { StockBadge } from '../components/StockBadge';
import { DetailSkeleton, ErrorState } from '../components/States';
import { formatPrice, prettyCategory } from '../lib/format';

const MAX_STOCK = 1_000_000;

export function DetailPage() {
  const { id = '' } = useParams();
  const back = `/${(useLocation().state as { search?: string } | null)?.search ?? ''}`;
  const q = useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: ({ signal }) => fetchProduct(id, signal),
    staleTime: 60_000,
  });

  return (
    <>
      <Link to={back} className="back">
        <span aria-hidden="true">&larr; </span>Back to stock
      </Link>
      {q.isPending && <DetailSkeleton />}
      {q.isError &&
        (q.error instanceof ApiError && q.error.status === 404 ? (
          <div className="card state" role="alert">
            <p>Item {id} was not found. It may have been removed.</p>
            <Link to="/">Go to the stock list</Link>
          </div>
        ) : (
          <ErrorState
            message="This item could not be loaded."
            onRetry={() => void q.refetch()}
          />
        ))}
      {q.data && <Detail product={q.data} />}
    </>
  );
}

function Detail({ product }: { product: Product }) {
  return (
    <article className="detail">
      <div className="card detail-main">
        {product.thumbnail && (
          <img
            className="detail-img"
            src={product.thumbnail}
            alt=""
            width="160"
            height="160"
          />
        )}
        <div>
          <p className="eyebrow">{prettyCategory(product.category)}</p>
          <h1>{product.title}</h1>
          <StockBadge stock={product.stock} />
          {product.description && <p className="muted">{product.description}</p>}
          <dl className="facts">
            {product.brand && (
              <>
                <dt>Brand</dt>
                <dd>{product.brand}</dd>
              </>
            )}
            {product.sku && (
              <>
                <dt>SKU</dt>
                <dd>{product.sku}</dd>
              </>
            )}
            <dt>Unit price</dt>
            <dd>{formatPrice(product.price)}</dd>
            <dt>Current stock</dt>
            <dd>{product.stock}</dd>
          </dl>
        </div>
      </div>
      <StockForm key={product.id} product={product} />
    </article>
  );
}

function StockForm({ product }: { product: Product }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(String(product.stock));
  const [invalid, setInvalid] = useState('');

  // Pessimistic on purpose: the button is disabled and the entry kept until the server answers.
  const save = useMutation({
    mutationFn: (stock: number) => updateStock(product.id, stock),
    onSuccess: (updated) => {
      qc.setQueryData(['products', 'detail', String(product.id)], updated);
      void qc.invalidateQueries({ queryKey: ['products', 'list'] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    const n = Number(value);
    if (!/^\d+$/.test(value.trim()) || n > MAX_STOCK) {
      setInvalid(`Enter a whole number from 0 to ${MAX_STOCK.toLocaleString()}.`);
      return;
    }
    setInvalid('');
    save.mutate(n);
  }

  return (
    <form onSubmit={onSubmit} className="card correct" noValidate>
      <h2>Correct stock count</h2>
      <p className="muted">
        Use this when a physical count disagrees with the system. The system currently
        holds {product.stock}.
      </p>
      <div className="correct-row">
        <label>
          New count
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (!save.isPending) save.reset(); // clear a stale "saved" or error message when editing again
            }}
            aria-invalid={Boolean(invalid)}
            aria-describedby="stock-msg"
          />
        </label>
        <button type="submit" className="primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save count'}
        </button>
      </div>
      <div id="stock-msg" aria-live="polite">
        {invalid && <p className="field-error">{invalid}</p>}
        {save.isError && (
          <p className="field-error">
            The count was not saved and is unchanged. Your entry is kept, so press Save
            count to retry.
          </p>
        )}
        {save.isSuccess && <p className="ok">Stock count saved.</p>}
      </div>
    </form>
  );
}
