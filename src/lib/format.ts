export const LOW_STOCK = 10;

export type StockLevel = 'out' | 'low' | 'ok';

/** Out of stock and low stock are separate states: a supplies team acts on them differently. */
export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) return 'out';
  return stock < LOW_STOCK ? 'low' : 'ok';
}

/** "mens-shirts" -> "Mens shirts". The API only gives slugs on product records. */
export function prettyCategory(slug: string): string {
  const text = slug.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const formatPrice = (price: number): string => `$${price.toFixed(2)}`;
