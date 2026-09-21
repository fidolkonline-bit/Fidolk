import type { Product } from "./types";

export function normalizeScannedSku(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function findProductByScannedSku(
  products: Product[],
  value: string,
): Product | undefined {
  const sku = normalizeScannedSku(value);
  if (!sku) return undefined;
  return products.find(
    (product) =>
      product.active !== false && normalizeScannedSku(product.sku) === sku,
  );
}
