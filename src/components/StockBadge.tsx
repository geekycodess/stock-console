import { stockLevel } from '../lib/format';

/** State is written out as well as coloured, so it never relies on colour alone. */
export function StockBadge({ stock }: { stock: number }) {
  const level = stockLevel(stock);
  const text =
    level === 'out'
      ? 'Out of stock'
      : level === 'low'
        ? `Low: ${stock} left`
        : `${stock} in stock`;
  return <span className={`badge badge-${level}`}>{text}</span>;
}
