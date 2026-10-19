import type { Department, Workspace } from "./types";
import { isReloadInvoice } from "./customers";

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

const colombo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** The shop's calendar day (Sri Lanka time) for a stored timestamp, as YYYY-MM-DD. */
export const businessDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : colombo.format(new Date(value));
export const inPeriod = (value: string, filters: ReportFilters) => {
  const valueDay = businessDay(value);
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
    !isReloadInvoice(sale) &&
    (filters.department === undefined ||
      filters.department === "All departments" ||
      sale.department === filters.department ||
      sale.department === "Mixed") &&
    (!filters.staffId || sale.staffId === filters.staffId);
  const sales = workspace.sales.filter(
    (sale) => inPeriod(sale.createdAt, filters) && matchesDimensions(sale),
  );
  const returns = workspace.returns.filter((item) => {
    const sale = workspace.sales.find(
      (candidate) => candidate.id === item.saleId,
    );
    return (
      !!sale && matchesDimensions(sale) && inPeriod(item.createdAt, filters)
    );
  });
  const fullReturns = workspace.sales.filter(
    (sale) =>
      matchesDimensions(sale) &&
      sale.status === "Returned" &&
      sale.returnInfo &&
      inPeriod(sale.returnInfo.at, filters),
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
