import type { Workspace } from "./types";

export interface InventoryPlanOptions {
  asOf?: string;
  lookbackDays?: number;
  targetDays?: number;
}

export interface InventoryPlanRow {
  productId: string;
  name: string;
  sku: string;
  stock: number;
  unitsSold: number;
  dailyVelocity: number;
  daysCover: number | null;
  oldestStockDays: number;
  stockValue: number;
  incoming: number;
  suggestedOrder: number;
  urgency: "Reorder" | "Watch" | "Healthy" | "No history";
}

export function inventoryPlan(
  workspace: Workspace,
  options: InventoryPlanOptions = {},
): InventoryPlanRow[] {
  const asOf = new Date(options.asOf ?? new Date().toISOString());
  const lookbackDays = Math.max(
    1,
    Math.round(
      options.lookbackDays ?? workspace.settings.inventoryLookbackDays ?? 30,
    ),
  );
  const targetDays = Math.max(
    1,
    Math.round(
      options.targetDays ?? workspace.settings.inventoryTargetDays ?? 30,
    ),
  );
  const from = asOf.getTime() - lookbackDays * 86400000;
  const sold = new Map<string, number>();
  for (const sale of workspace.sales) {
    const timestamp = Date.parse(sale.createdAt);
    if (timestamp < from || timestamp > asOf.getTime()) continue;
    for (const line of sale.lines)
      sold.set(line.productId, (sold.get(line.productId) ?? 0) + line.quantity);
  }
  for (const item of workspace.returns) {
    const timestamp = Date.parse(item.createdAt);
    if (timestamp < from || timestamp > asOf.getTime()) continue;
    const sale = workspace.sales.find(
      (candidate) => candidate.id === item.saleId,
    );
    if (!sale) continue;
    for (const returned of item.items) {
      const productId = sale.lines[returned.lineIndex]?.productId;
      if (productId)
        sold.set(
          productId,
          Math.max(0, (sold.get(productId) ?? 0) - returned.quantity),
        );
    }
  }
  for (const sale of workspace.sales) {
    if (sale.status !== "Returned" || !sale.returnInfo) continue;
    const timestamp = Date.parse(sale.returnInfo.at);
    if (timestamp < from || timestamp > asOf.getTime()) continue;
    for (const line of sale.lines)
      sold.set(
        line.productId,
        Math.max(0, (sold.get(line.productId) ?? 0) - line.quantity),
      );
  }
  return workspace.products
    .filter((product) => product.active !== false)
    .map((product) => {
      const unitsSold = sold.get(product.id) ?? 0;
      const dailyVelocity = unitsSold / lookbackDays;
      const batches = workspace.batches.filter(
        (batch) => batch.productId === product.id && batch.remaining > 0,
      );
      const oldest = batches.reduce(
        (value, batch) => Math.min(value, Date.parse(batch.receivedAt)),
        asOf.getTime(),
      );
      const incoming = workspace.purchaseOrders
        .filter((order) =>
          ["Ordered", "Partially received"].includes(order.status),
        )
        .flatMap((order) => order.lines)
        .filter((line) => line.productId === product.id)
        .reduce((sum, line) => sum + line.ordered - line.received, 0);
      const desired = Math.max(
        product.reorderLevel,
        Math.ceil(dailyVelocity * targetDays),
      );
      const suggestedOrder = Math.max(0, desired - product.stock - incoming);
      const daysCover = dailyVelocity ? product.stock / dailyVelocity : null;
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        unitsSold,
        dailyVelocity: Math.round(dailyVelocity * 100) / 100,
        daysCover: daysCover === null ? null : Math.round(daysCover * 10) / 10,
        oldestStockDays: Math.max(
          0,
          Math.floor((asOf.getTime() - oldest) / 86400000),
        ),
        stockValue: batches.reduce(
          (sum, batch) => sum + batch.remaining * batch.unitCost,
          0,
        ),
        incoming,
        suggestedOrder,
        urgency:
          unitsSold === 0
            ? "No history"
            : suggestedOrder > 0
              ? "Reorder"
              : daysCover !== null && daysCover <= targetDays * 1.25
                ? "Watch"
                : "Healthy",
      } satisfies InventoryPlanRow;
    })
    .sort(
      (a, b) =>
        b.suggestedOrder - a.suggestedOrder || a.daysCover! - b.daysCover!,
    );
}
