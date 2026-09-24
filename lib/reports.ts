import type { Department, Workspace } from "./types";

export interface ReportFilters {
  from: string;
  to: string;
  department?: Department | "All departments";
  staffId?: string;
}

export interface ReportTotals {
  invoiceRevenue: number;
  returns: number;
  netSales: number;
  cost: number;
  grossMargin: number;
  collections: number;
  discounts: number;
  transactions: number;
  units: number;
}

const day = (value: string) => value.slice(0, 10);
const included = (value: string, filters: ReportFilters) => {
  const valueDay = day(value);
  return valueDay >= filters.from && valueDay <= filters.to;
};

export function previousPeriod(filters: ReportFilters): ReportFilters {
  const from = new Date(`${filters.from}T00:00:00Z`);
  const to = new Date(`${filters.to}T00:00:00Z`);
  const days = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86400000) + 1,
  );
  const previousTo = new Date(from.getTime() - 86400000);
  const previousFrom = new Date(previousTo.getTime() - (days - 1) * 86400000);
  return {
    ...filters,
    from: previousFrom.toISOString().slice(0, 10),
    to: previousTo.toISOString().slice(0, 10),
  };
}

export function reportTotals(
  workspace: Workspace,
  filters: ReportFilters,
): ReportTotals {
  const matchesDimensions = (sale: Workspace["sales"][number]) =>
    (filters.department === undefined ||
      filters.department === "All departments" ||
      sale.department === filters.department ||
      sale.department === "Mixed") &&
    (!filters.staffId || sale.staffId === filters.staffId);
  const sales = workspace.sales.filter(
    (sale) => included(sale.createdAt, filters) && matchesDimensions(sale),
  );
  const returns = workspace.returns.filter((item) => {
    const sale = workspace.sales.find(
      (candidate) => candidate.id === item.saleId,
    );
    return (
      !!sale && matchesDimensions(sale) && included(item.createdAt, filters)
    );
  });
  const fullReturns = workspace.sales.filter(
    (sale) =>
      matchesDimensions(sale) &&
      sale.status === "Returned" &&
      sale.returnInfo &&
      included(sale.returnInfo.at, filters),
  );
  const returned =
    returns.reduce((sum, item) => sum + item.total, 0) +
    fullReturns.reduce((sum, sale) => sum + sale.total, 0);
  const returnedCost =
    returns.reduce((sum, item) => sum + item.cost, 0) +
    fullReturns.reduce((sum, sale) => sum + sale.cost, 0);
  const invoiceRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const cost = sales.reduce((sum, sale) => sum + sale.cost, 0) - returnedCost;
  return {
    invoiceRevenue,
    returns: returned,
    netSales: invoiceRevenue - returned,
    cost,
    grossMargin: invoiceRevenue - returned - cost,
    collections: sales.reduce((sum, sale) => sum + sale.paid, 0),
    discounts: sales.reduce((sum, sale) => sum + sale.discount, 0),
    transactions: sales.length,
    units:
      sales
        .flatMap((sale) => sale.lines)
        .reduce((sum, line) => sum + line.quantity, 0) -
      returns
        .flatMap((item) => item.items)
        .reduce((sum, item) => sum + item.quantity, 0) -
      fullReturns
        .flatMap((sale) => sale.lines)
        .reduce((sum, line) => sum + line.quantity, 0),
  };
}

export function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function productPerformance(
  workspace: Workspace,
  filters: ReportFilters,
) {
  const rows = new Map<
    string,
    {
      productId: string;
      name: string;
      units: number;
      revenue: number;
      cost: number;
    }
  >();
  for (const sale of workspace.sales) {
    if (!included(sale.createdAt, filters)) continue;
    if (
      filters.department &&
      filters.department !== "All departments" &&
      sale.department !== filters.department &&
      sale.department !== "Mixed"
    )
      continue;
    if (filters.staffId && sale.staffId !== filters.staffId) continue;
    for (const line of sale.lines) {
      const row = rows.get(line.productId) ?? {
        productId: line.productId,
        name: line.name,
        units: 0,
        revenue: 0,
        cost: 0,
      };
      row.units += line.quantity;
      row.revenue += line.total ?? line.price * line.quantity;
      row.cost += line.batchAllocations.reduce(
        (sum, allocation) => sum + allocation.quantity * allocation.unitCost,
        0,
      );
      rows.set(line.productId, row);
    }
  }
  for (const item of workspace.returns) {
    if (!included(item.createdAt, filters)) continue;
    const sale = workspace.sales.find(
      (candidate) => candidate.id === item.saleId,
    );
    if (!sale) continue;
    if (
      filters.department &&
      filters.department !== "All departments" &&
      sale.department !== filters.department &&
      sale.department !== "Mixed"
    )
      continue;
    if (filters.staffId && sale.staffId !== filters.staffId) continue;
    for (const returned of item.items) {
      const line = sale.lines[returned.lineIndex];
      if (!line) continue;
      const row = rows.get(line.productId) ?? {
        productId: line.productId,
        name: line.name,
        units: 0,
        revenue: 0,
        cost: 0,
      };
      row.units -= returned.quantity;
      row.revenue -= returned.amount;
      row.cost -= returned.cost;
      rows.set(line.productId, row);
    }
  }
  for (const sale of workspace.sales) {
    if (
      sale.status !== "Returned" ||
      !sale.returnInfo ||
      !included(sale.returnInfo.at, filters)
    )
      continue;
    if (
      filters.department &&
      filters.department !== "All departments" &&
      sale.department !== filters.department &&
      sale.department !== "Mixed"
    )
      continue;
    if (filters.staffId && sale.staffId !== filters.staffId) continue;
    for (const line of sale.lines) {
      const row = rows.get(line.productId) ?? {
        productId: line.productId,
        name: line.name,
        units: 0,
        revenue: 0,
        cost: 0,
      };
      row.units -= line.quantity;
      row.revenue -= line.total ?? line.price * line.quantity;
      row.cost -= line.batchAllocations.reduce(
        (sum, allocation) => sum + allocation.quantity * allocation.unitCost,
        0,
      );
      rows.set(line.productId, row);
    }
  }
  return [...rows.values()]
    .map((row) => ({ ...row, margin: row.revenue - row.cost }))
    .sort((a, b) => b.margin - a.margin);
}
