import type { CartPricingItem, Workspace } from "../lib/types";

/**
 * Every sale line names its lot. Tests that aren't about lots take the
 * oldest stock first, as a cashier picking from the lot list would. Items
 * that already name a lot or an IMEI, or that ask for more than is in
 * stock, are left alone so the sale rules still see them as written.
 */
export function fromOldestLots(
  s: Workspace,
  items: readonly CartPricingItem[],
): CartPricingItem[] {
  const used = new Map<string, number>();
  return items.flatMap((item) => {
    const product = s.products.find((p) => p.id === item?.productId);
    if (!product || product.serialized || item.batchId || item.imei)
      return [item];
    const lots = s.batches
      .filter((b) => b.productId === product.id)
      .map((b) => ({ id: b.id, left: b.remaining - (used.get(b.id) ?? 0) }))
      .filter((b) => b.left > 0)
      .sort((a, b) =>
        s.batches
          .find((x) => x.id === a.id)!
          .receivedAt.localeCompare(
            s.batches.find((x) => x.id === b.id)!.receivedAt,
          ),
      );
    const quantity = Number(item.quantity);
    if (lots.reduce((n, b) => n + b.left, 0) < quantity) return [item];
    let left = quantity;
    const split: CartPricingItem[] = [];
    for (const lot of lots) {
      const take = Math.min(left, lot.left);
      used.set(lot.id, (used.get(lot.id) ?? 0) + take);
      split.push({ ...item, quantity: take, batchId: lot.id });
      left -= take;
      if (!left) break;
    }
    return split;
  });
}

/** Sale-shaped actions get their lots picked before they run. */
export function withLots(
  s: Workspace,
  type: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return ["createSale", "parkCart", "createSaleQuote"].includes(type) &&
    Array.isArray(payload.items)
    ? { ...payload, items: fromOldestLots(s, payload.items) }
    : payload;
}
