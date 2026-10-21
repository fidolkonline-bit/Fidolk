import type { Batch, PurchaseOrder } from "./types";

export type CostPoint = {
  date: string;
  supplier: string;
  unitCost: number;
  quantity: number;
  lot: string;
};

export type PurchaseHistory = {
  /** Most recent deliveries first. */
  receipts: CostPoint[];
  last?: CostPoint;
  /** Last delivery from the supplier on this order, when there is one. */
  lastFromSupplier?: CostPoint;
  lowest?: CostPoint;
  /** Quantity-weighted average unit cost over every delivery. */
  averageCost?: number;
  /** Units still to arrive on open purchase orders. */
  onOrder: number;
  openOrders: string[];
};

/**
 * What we paid for an item before, read from its lots (every delivery makes
 * one) and from purchase orders still waiting for goods.
 */
export function purchaseHistory(
  productId: string,
  batches: readonly Batch[],
  purchaseOrders: readonly PurchaseOrder[],
  supplier?: string,
): PurchaseHistory {
  const receipts = batches
    .filter((b) => b.productId === productId)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((b) => ({
      date: b.receivedAt,
      supplier: b.supplier,
      unitCost: b.unitCost,
      quantity: b.quantity,
      lot: b.lot,
    }));
  const name = supplier?.trim().toLowerCase();
  const units = receipts.reduce((sum, r) => sum + r.quantity, 0);
  const open = purchaseOrders.filter(
    (po) => po.status === "Ordered" || po.status === "Partially received",
  );
  const openOrders: string[] = [];
  let onOrder = 0;
  for (const po of open) {
    const due = po.lines
      .filter((line) => line.productId === productId)
      .reduce((sum, line) => sum + line.ordered - line.received, 0);
    if (due > 0) {
      onOrder += due;
      openOrders.push(po.number);
    }
  }
  return {
    receipts,
    last: receipts[0],
    lastFromSupplier: name
      ? receipts.find((r) => r.supplier.trim().toLowerCase() === name)
      : undefined,
    lowest: receipts.reduce<CostPoint | undefined>(
      (low, r) => (!low || r.unitCost < low.unitCost ? r : low),
      undefined,
    ),
    averageCost: units
      ? Math.round(
          receipts.reduce((sum, r) => sum + r.unitCost * r.quantity, 0) / units,
        )
      : undefined,
    onOrder,
    openOrders,
  };
}

/** Percent change from the earlier cost, rounded; undefined when unknown. */
export function costChange(now: number, before?: number): number | undefined {
  if (!before || !now) return undefined;
  return Math.round(((now - before) / before) * 100);
}
