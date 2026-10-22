import type { Batch, Product } from "./types";

export function normalizeScannedSku(value: string) {
  return value.trim().toLocaleLowerCase();
}

const bySku = (products: Product[], value: string) => {
  const sku = normalizeScannedSku(value);
  if (!sku) return undefined;
  return products.find(
    (product) =>
      product.active !== false && normalizeScannedSku(product.sku) === sku,
  );
};

/**
 * Reads a product sticker. Lot stickers hold `SKU-n` (see `lotBarcode`), so
 * the scan names the lot as well; older stickers hold only the SKU. An exact
 * SKU match wins, in case a SKU itself contains a dash.
 */
export function findScannedStock(
  products: Product[],
  batches: Batch[],
  value: string,
): { product: Product; batch?: Batch } | undefined {
  const exact = bySku(products, value);
  if (exact) return { product: exact };
  const match = value.trim().match(/^(.+)-(\d{1,6})$/);
  if (!match) return undefined;
  const product = bySku(products, match[1]);
  if (!product) return undefined;
  const labelNo = Number(match[2]);
  return {
    product,
    batch: batches.find(
      (b) => b.productId === product.id && b.labelNo === labelNo,
    ),
  };
}

/** The product on a sticker, whether it is a lot sticker or SKU only. */
export function findProductByScannedSku(
  products: Product[],
  value: string,
): Product | undefined {
  return findScannedStock(products, [], value)?.product;
}
