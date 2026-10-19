import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import {
  groupProfit,
  profitCsv,
  profitKey,
  profitRows,
  PROFIT_DRILL,
  profitTotals,
  NO_BRAND,
  RELOADS,
  type ProfitDimension,
} from "../lib/profit";
import { reportTotals } from "../lib/reports";
import type { Workspace } from "../lib/types";

const run = (
  s: Workspace,
  type: string,
  payload: Record<string, unknown>,
  now?: string,
) => applyAction(s, { type, payload, requestId: randomUUID() }, now);
const everything = { from: "2000-01-01", to: "2100-12-31" };
const dimensions: ProfitDimension[] = [
  "product",
  "category",
  "brand",
  "shop",
  "invoice",
  "customer",
  "day",
];

/** A day of trading: a mixed bill with a discount and an agent, a partial return, a full return, reloads and a wallet top-up. */
function trading() {
  const s = createSeed();
  s.settings.commissionConfirmed = true;
  run(s, "setProductBrand", { productIds: ["prod-2"], brand: "Spigen" });
  run(
    s,
    "createSale",
    {
      customerId: "cust-1",
      items: [
        { productId: "prod-1", quantity: 1, imei: "356789012340001" },
        { productId: "prod-2", quantity: 2 },
        { productId: "prod-5", quantity: 1 },
      ],
      discount: 10000,
      paid: 18990000 + 240000 + 240000 - 10000,
      method: "Cash",
      agent: true,
    },
    "2026-10-18T05:00:00.000Z",
  );
  const mixed = s.sales.at(-1)!;
  run(
    s,
    "returnItems",
    {
      saleId: mixed.id,
      items: [{ lineIndex: 1, quantity: 1, disposition: "Restock" }],
      resolution: "Refund",
      reason: "Faulty",
    },
    "2026-10-18T07:00:00.000Z",
  );
  run(
    s,
    "createSale",
    {
      customerId: "cust-2",
      items: [{ productId: "prod-3", quantity: 1 }],
      paid: 450000,
      method: "Cash",
    },
    "2026-10-18T08:00:00.000Z",
  );
  const returned = s.sales.at(-1)!;
  run(
    s,
    "returnSale",
    { saleId: returned.id, disposition: "Restock", reason: "Changed mind" },
    "2026-10-19T04:00:00.000Z",
  );
  run(
    s,
    "addReload",
    { provider: "Dialog", type: "Top-up", phone: "", amount: 1000000 },
    "2026-10-18T03:00:00.000Z",
  );
  run(
    s,
    "addReload",
    {
      provider: "Dialog",
      type: "Reload",
      phone: "0771234567",
      amount: 50000,
      commission: 2000,
    },
    "2026-10-18T09:00:00.000Z",
  );
  run(
    s,
    "createSale",
    {
      customerId: "cust-3",
      items: [{ productId: "prod-4", quantity: 1 }],
      reloads: [
        {
          provider: "Dialog",
          type: "Reload",
          phone: "0771234567",
          amount: 20000,
          commission: 800,
        },
      ],
      paid: 150000,
      method: "Cash",
    },
    "2026-10-18T10:00:00.000Z",
  );
  return { s, mixed, returned, bill: s.sales.at(-1)! };
}

test("every profit report adds up to the same total, and goods match the Reports page", () => {
  const { s } = trading();
  const rows = profitRows(s, everything);
  const totals = profitTotals(rows);
  for (const by of dimensions) {
    const groups = groupProfit(rows, by);
    assert.equal(
      groups.reduce((sum, group) => sum + group.netProfit, 0),
      totals.netProfit,
      by,
    );
    assert.equal(
      groups.reduce((sum, group) => sum + group.sales, 0),
      totals.sales,
      by,
    );
  }
  const goods = profitTotals(rows.filter((row) => row.kind !== "Reload"));
  const report = reportTotals(s, everything);
  assert.equal(goods.sales, report.netSales);
  assert.equal(goods.cost, report.cost);
  assert.equal(goods.grossProfit, report.grossMargin);
  assert.equal(goods.units, report.units);
});

test("net profit is after the commission still owed on each invoice", () => {
  const { s, mixed } = trading();
  assert.ok(mixed.commission > 0 && mixed.agentCommission > 0);
  const goods = profitRows(s, everything).filter(
    (row) => row.kind !== "Reload",
  );
  const totals = profitTotals(goods);
  assert.equal(
    totals.staffCommission,
    s.sales.reduce((sum, sale) => sum + sale.commission, 0),
  );
  assert.equal(
    totals.agentCommission,
    s.sales.reduce((sum, sale) => sum + sale.agentCommission, 0),
  );
  assert.equal(
    totals.netProfit,
    totals.grossProfit - totals.staffCommission - totals.agentCommission,
  );
});

test("a bill with phones and clothes splits its profit between the two shops", () => {
  const { s, mixed } = trading();
  assert.equal(mixed.department, "Mixed");
  const rows = profitRows(s, everything).filter(
    (row) => row.saleId === mixed.id,
  );
  const shops = groupProfit(rows, "shop");
  assert.deepEqual(shops.map((shop) => shop.key).sort(), [
    "Clothing",
    "Phones",
  ]);
  const clothing = shops.find((shop) => shop.key === "Clothing")!;
  assert.equal(clothing.units, 1);
  assert.equal(clothing.sales, mixed.lines[2].total);
  const clothingOnly = profitRows(s, {
    ...everything,
    department: "Clothing",
  });
  assert.ok(clothingOnly.every((row) => row.department === "Clothing"));
});

test("brand and category are what the line was sold as, with older sales falling back to the product", () => {
  const { s, mixed } = trading();
  run(s, "setProductBrand", { productIds: ["prod-2"], brand: "Baseus" });
  s.products.find((p) => p.id === "prod-2")!.category = "Cases";
  const rows = profitRows(s, everything);
  const accessory = rows.find(
    (row) => row.saleId === mixed.id && row.productId === "prod-2",
  )!;
  assert.equal(accessory.brand, "Spigen");
  assert.equal(accessory.category, "Accessories");
  const seeded = rows.find((row) => row.saleId === "sale-1")!;
  const product = s.products.find((p) => p.id === seeded.productId)!;
  assert.equal(seeded.category, product.category);
  assert.equal(seeded.brand, product.brand ?? NO_BRAND);
});

test("reloads count their commission, belong to their bill, and top-ups are left out", () => {
  const { s, bill } = trading();
  const reloads = profitRows(s, everything).filter(
    (row) => row.kind === "Reload",
  );
  assert.equal(reloads.length, 2);
  assert.ok(reloads.every((row) => row.category === RELOADS));
  assert.ok(reloads.every((row) => row.brand === "Dialog"));
  assert.deepEqual(
    reloads.map((row) => row.sales),
    [2000, 800],
  );
  const onBill = reloads.find((row) => row.sales === 800)!;
  assert.equal(onBill.saleId, bill.id);
  assert.equal(onBill.customerId, "cust-3");
  const counter = reloads.find((row) => row.sales === 2000)!;
  assert.equal(counter.invoice, undefined);
  assert.equal(counter.customerId, "cust-walkin");
});

test("returns count on the day they happen, and days are Sri Lanka days", () => {
  const { s, returned } = trading();
  const returnDay = profitRows(s, { from: "2026-10-19", to: "2026-10-19" });
  assert.ok(
    returnDay.some(
      (row) => row.saleId === returned.id && row.kind === "Return",
    ),
  );
  assert.ok(
    !returnDay.some((row) => row.saleId === returned.id && row.kind === "Sale"),
  );
  run(
    s,
    "createSale",
    {
      customerId: "cust-1",
      items: [{ productId: "prod-4", quantity: 1 }],
      paid: 150000,
      method: "Cash",
    },
    "2026-10-19T20:00:00.000Z",
  );
  const late = profitRows(s, everything).at(-1)!;
  assert.equal(late.day, "2026-10-20");
});

test("profit by day lists every day in the period, in order", () => {
  const { s } = trading();
  const period = { from: "2026-10-17", to: "2026-10-21" };
  const days = groupProfit(profitRows(s, period), "day", period);
  assert.deepEqual(
    days.map((day) => day.key),
    ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"],
  );
  assert.equal(days[0].sales, 0);
  assert.equal(days[0].margin, null);
});

test("older invoices without line totals share the invoice discount and commission by line value", () => {
  const s = createSeed();
  const sale = s.sales[0];
  sale.lines.push({ ...sale.lines[0], quantity: 1 });
  sale.subtotal = sale.lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  sale.discount = 1001;
  sale.total = sale.subtotal - sale.discount;
  sale.commission = 333;
  const rows = profitRows(s, everything).filter(
    (row) => row.saleId === sale.id,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.sales, 0),
    sale.total,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.staffCommission, 0),
    333,
  );
});

test("sold lines with no recorded cost are counted so the report can warn", () => {
  const s = createSeed();
  const line = s.sales[0].lines[0];
  line.batchAllocations = [];
  line.cost = 0;
  const totals = profitTotals(profitRows(s, everything));
  assert.equal(totals.costMissing, 1);
});

test("opening a group narrows to its rows and the next level adds back up to it", () => {
  const { s } = trading();
  const rows = profitRows(s, everything);
  for (const group of groupProfit(rows, "category")) {
    const inside = rows.filter(
      (row) => profitKey(row, "category") === group.key,
    );
    const next = groupProfit(inside, PROFIT_DRILL.category!);
    assert.equal(
      next.reduce((sum, item) => sum + item.netProfit, 0),
      group.netProfit,
    );
  }
  assert.equal(PROFIT_DRILL.invoice, null);
});

test("the CSV has rupee amounts, keeps negatives as numbers, and defuses formulas in names", () => {
  const { s } = trading();
  const groups = groupProfit(profitRows(s, everything), "product");
  groups[0].label = "=HYPERLINK(1)";
  groups[0].netProfit = -12345;
  const [head, first] = profitCsv(groups, "Product").split("\n");
  assert.match(head, /^"Product","Units","Sales \(Rs\)"/);
  assert.ok(first.startsWith(`"'=HYPERLINK(1)"`));
  assert.ok(first.includes(`"-123.45"`));
});
