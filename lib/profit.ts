import { businessDay, inPeriod, type ReportFilters } from "./reports";
import { shareOut } from "./share-out";
import type { Department, Sale, SaleLine, Workspace } from "./types";

/**
 * Profit, line by line. Every sold line, returned line and reload becomes one
 * row; every profit report is those rows added up by a different field, so the
 * reports always agree with each other.
 *
 * - Sales are the line's net total, after line and invoice discounts.
 * - Cost is what the stock lots actually cost.
 * - Returns count on the day they happen, as negative rows.
 * - A reload's sale is the commission the shop keeps; its face value only
 *   passes through to the provider. Wallet top-ups are not sales.
 * - Net profit is after staff and agent commission.
 */
export interface ProfitRow {
  kind: "Sale" | "Return" | "Reload";
  at: string;
  day: string;
  /** Missing for a reload sold without a bill. */
  saleId?: string;
  invoice?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  category: string;
  brand: string;
  department: Department;
  staffId?: string;
  units: number;
  sales: number;
  cost: number;
  staffCommission: number;
  agentCommission: number;
}

export type ProfitDimension =
  "product" | "category" | "brand" | "shop" | "invoice" | "customer" | "day";

export interface ProfitTotals {
  units: number;
  sales: number;
  cost: number;
  grossProfit: number;
  staffCommission: number;
  agentCommission: number;
  netProfit: number;
  /** Net profit as a percentage of sales; null when there were no sales. */
  margin: number | null;
  /** Sold lines with no recorded cost, which overstate profit. */
  costMissing: number;
}

export interface ProfitGroup extends ProfitTotals {
  key: string;
  label: string;
  /** This group's share of the period's net profit, as a percentage. */
  share: number | null;
  rows: ProfitRow[];
}

export const NO_BRAND = "No brand";
export const NO_INVOICE = "No bill";
export const RELOADS = "Reloads";

const lineCost = (line: SaleLine) =>
  line.batchAllocations.length
    ? line.batchAllocations.reduce(
        (sum, allocation) => sum + allocation.quantity * allocation.unitCost,
        0,
      )
    : line.cost;

/** Each line's net sales. Older invoices without line totals share the invoice discount by line value. */
function lineSales(sale: Sale) {
  if (sale.lines.every((line) => line.total !== undefined))
    return sale.lines.map((line) => line.total!);
  return shareOut(
    sale.total,
    sale.lines.map((line) => line.price * line.quantity),
  );
}

/** Each line's commission. Older invoices only know the invoice's commission, so it is shared by line value. */
function lineCommission(sale: Sale, sales: number[]) {
  if (
    sale.lines.every(
      (line) =>
        line.staffCommission !== undefined &&
        line.agentCommission !== undefined,
    )
  )
    return sale.lines.map((line) => ({
      staff: line.staffCommission!,
      agent: line.agentCommission!,
    }));
  const weights = sales.map((amount) => Math.max(0, amount));
  const staff = shareOut(Math.max(0, sale.commission), weights);
  const agent = shareOut(Math.max(0, sale.agentCommission), weights);
  return sales.map((_, index) => ({
    staff: staff[index],
    agent: agent[index],
  }));
}

export function profitRows(
  workspace: Workspace,
  filters: ReportFilters,
): ProfitRow[] {
  const products = new Map(workspace.products.map((p) => [p.id, p]));
  const customers = new Map(workspace.customers.map((c) => [c.id, c]));
  const sales = new Map(workspace.sales.map((sale) => [sale.id, sale]));
  const customerName = (sale: Sale) =>
    customers.get(sale.customerId)?.name ?? sale.customerName;
  const wanted = (row: ProfitRow) =>
    inPeriod(row.at, filters) &&
    (!filters.department ||
      filters.department === "All departments" ||
      row.department === filters.department) &&
    (!filters.staffId || row.staffId === filters.staffId);

  /** What a line was sold as. Newer lines carry it; older ones fall back to the product as it is now. */
  const describe = (sale: Sale, line: SaleLine) => {
    const product = products.get(line.productId);
    const snapshot = line.category !== undefined;
    return {
      saleId: sale.id,
      invoice: sale.number,
      customerId: sale.customerId,
      customerName: customerName(sale),
      productId: line.productId,
      productName: line.name,
      category:
        (snapshot ? line.category : product?.category) || "Uncategorized",
      brand: (snapshot ? line.brand : product?.brand) || NO_BRAND,
      department:
        line.department ??
        product?.department ??
        (sale.department === "Mixed" ? "Phones" : sale.department),
      staffId: sale.staffId,
    };
  };

  const rows: ProfitRow[] = [];
  const add = (row: ProfitRow) => {
    if (wanted(row)) rows.push(row);
  };

  for (const sale of workspace.sales) {
    if (!sale.lines.length) continue;
    const amounts = lineSales(sale);
    const commissions = lineCommission(sale, amounts);
    sale.lines.forEach((line, index) => {
      const base = describe(sale, line);
      const sold = {
        units: line.quantity,
        sales: amounts[index],
        cost: lineCost(line),
        staffCommission: commissions[index].staff,
        agentCommission: commissions[index].agent,
      };
      add({
        kind: "Sale",
        at: sale.createdAt,
        day: businessDay(sale.createdAt),
        ...base,
        ...sold,
      });
      // A whole-invoice return gives back every line as it was sold.
      if (sale.returnInfo)
        add({
          kind: "Return",
          at: sale.returnInfo.at,
          day: businessDay(sale.returnInfo.at),
          ...base,
          units: -sold.units,
          sales: -sold.sales,
          cost: -sold.cost,
          staffCommission: -sold.staffCommission,
          agentCommission: -sold.agentCommission,
        });
    });
  }

  for (const item of workspace.returns) {
    const sale = sales.get(item.saleId);
    if (!sale) continue;
    for (const returned of item.items) {
      const line = sale.lines[returned.lineIndex];
      if (!line) continue;
      add({
        kind: "Return",
        at: item.createdAt,
        day: businessDay(item.createdAt),
        ...describe(sale, line),
        units: -returned.quantity,
        sales: -returned.amount,
        cost: -returned.cost,
        staffCommission: -(returned.staffCommission ?? 0),
        agentCommission: -(returned.agentCommission ?? 0),
      });
    }
  }

  // A reload belongs to the bill that links it, or else the bill rung up in the same moment.
  const reloadSale = new Map<string, Sale>();
  const salesAt = new Map<string, Sale>();
  for (const sale of workspace.sales) {
    for (const reload of sale.reloads ?? [])
      reloadSale.set(reload.reloadId, sale);
    if (!salesAt.has(sale.createdAt)) salesAt.set(sale.createdAt, sale);
  }
  for (const reload of workspace.reloads) {
    if (reload.type === "Top-up") continue;
    const sale = reloadSale.get(reload.id) ?? salesAt.get(reload.date);
    const walkIn = customers.get("cust-walkin");
    add({
      kind: "Reload",
      at: reload.date,
      day: businessDay(reload.date),
      saleId: sale?.id,
      invoice: sale?.number,
      customerId: sale?.customerId ?? walkIn?.id ?? "cust-walkin",
      customerName: sale ? customerName(sale) : (walkIn?.name ?? "Walk-in"),
      productId: `reload:${reload.provider}:${reload.type}`,
      productName: `${reload.provider} ${reload.type.toLowerCase()}`,
      category: RELOADS,
      brand: reload.provider,
      department: "Phones",
      staffId: sale?.staffId,
      units: 1,
      sales: reload.commission,
      cost: 0,
      staffCommission: 0,
      agentCommission: 0,
    });
  }

  return rows.sort((a, b) => a.at.localeCompare(b.at));
}

export function profitTotals(rows: ProfitRow[]): ProfitTotals {
  const totals = {
    units: 0,
    sales: 0,
    cost: 0,
    staffCommission: 0,
    agentCommission: 0,
    costMissing: 0,
  };
  for (const row of rows) {
    totals.units += row.units;
    totals.sales += row.sales;
    totals.cost += row.cost;
    totals.staffCommission += row.staffCommission;
    totals.agentCommission += row.agentCommission;
    if (row.kind === "Sale" && row.cost === 0 && row.sales > 0)
      totals.costMissing++;
  }
  const grossProfit = totals.sales - totals.cost;
  const netProfit =
    grossProfit - totals.staffCommission - totals.agentCommission;
  return {
    ...totals,
    grossProfit,
    netProfit,
    margin: percent(netProfit, totals.sales),
  };
}

const percent = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 10;

const keyOf: Record<
  ProfitDimension,
  (row: ProfitRow) => { key: string; label: string }
> = {
  product: (row) => ({ key: row.productId, label: row.productName }),
  category: (row) => ({ key: row.category, label: row.category }),
  brand: (row) => ({ key: row.brand, label: row.brand }),
  shop: (row) => ({ key: row.department, label: row.department }),
  invoice: (row) => ({
    key: row.saleId ?? "",
    label: row.invoice ?? NO_INVOICE,
  }),
  customer: (row) => ({ key: row.customerId, label: row.customerName }),
  day: (row) => ({ key: row.day, label: row.day }),
};

const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);

/**
 * Adds rows up by one field. Groups come most profitable first, except days,
 * which run in date order and include days with no sales when a period is given.
 */
export function groupProfit(
  rows: ProfitRow[],
  by: ProfitDimension,
  period?: Pick<ReportFilters, "from" | "to">,
): ProfitGroup[] {
  const grouped = new Map<string, { label: string; rows: ProfitRow[] }>();
  for (const row of rows) {
    const { key, label } = keyOf[by](row);
    const group = grouped.get(key) ?? { label, rows: [] };
    group.rows.push(row);
    grouped.set(key, group);
  }
  if (by === "day" && period && period.from <= period.to)
    for (let day = period.from; day <= period.to; day = nextDay(day))
      if (!grouped.has(day)) grouped.set(day, { label: day, rows: [] });
  const netProfit = profitTotals(rows).netProfit;
  const groups = [...grouped].map(([key, group]) => {
    const totals = profitTotals(group.rows);
    return {
      key,
      label: group.label,
      ...totals,
      share: percent(totals.netProfit, netProfit),
      rows: group.rows,
    };
  });
  return by === "day"
    ? groups.sort((a, b) => a.key.localeCompare(b.key))
    : groups.sort(
        (a, b) => b.netProfit - a.netProfit || a.label.localeCompare(b.label),
      );
}

/** Which group a row falls in for a report. */
export const profitKey = (row: ProfitRow, by: ProfitDimension) =>
  keyOf[by](row).key;

/** What opening a group shows next. An invoice opens the bill itself. */
export const PROFIT_DRILL: Record<ProfitDimension, ProfitDimension | null> = {
  shop: "category",
  category: "product",
  brand: "product",
  product: "invoice",
  customer: "invoice",
  day: "invoice",
  invoice: null,
};

/** The groups as a spreadsheet, amounts in rupees. */
export function profitCsv(groups: ProfitGroup[], heading: string) {
  const cell = (value: string | number | null) => {
    const raw = String(value ?? "");
    const safe =
      /^[=+@\-]/.test(raw) && typeof value === "string" ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rupees = (cents: number) => cents / 100;
  return [
    [
      heading,
      "Units",
      "Sales (Rs)",
      "Stock cost (Rs)",
      "Gross profit (Rs)",
      "Staff commission (Rs)",
      "Agent commission (Rs)",
      "Net profit (Rs)",
      "Margin %",
      "Share of profit %",
    ],
    ...groups.map((group) => [
      group.label,
      group.units,
      rupees(group.sales),
      rupees(group.cost),
      rupees(group.grossProfit),
      rupees(group.staffCommission),
      rupees(group.agentCommission),
      rupees(group.netProfit),
      group.margin,
      group.share,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\n");
}
