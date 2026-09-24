import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../lib/seed";
import {
  percentageChange,
  previousPeriod,
  productPerformance,
  reportTotals,
} from "../lib/reports";

test("reports apply inclusive date windows and previous periods", () => {
  const s = createSeed();
  const reportDay = s.sales[0].createdAt.slice(0, 10);
  const totals = reportTotals(s, {
    from: reportDay,
    to: reportDay,
    department: "All departments",
  });
  assert.ok(totals.transactions > 0);
  assert.ok(totals.invoiceRevenue >= totals.netSales);
  assert.deepEqual(previousPeriod({ from: "2026-09-10", to: "2026-09-17" }), {
    from: "2026-09-02",
    to: "2026-09-09",
  });
  assert.equal(percentageChange(120, 100), 20);
  assert.equal(percentageChange(1, 0), null);
});

test("product performance nets partial returns", () => {
  const s = createSeed();
  const sale = s.sales[0];
  s.returns.push({
    id: "return-report",
    saleId: sale.id,
    saleNumber: sale.number,
    items: [
      {
        lineIndex: 0,
        quantity: 1,
        disposition: "Restock",
        amount: sale.lines[0].price,
        cost: sale.lines[0].cost,
      },
    ],
    resolution: "Refund",
    reason: "Test",
    total: sale.lines[0].price,
    cost: sale.lines[0].cost,
    createdAt: sale.createdAt,
  });
  const rows = productPerformance(s, {
    from: sale.createdAt.slice(0, 10),
    to: sale.createdAt.slice(0, 10),
  });
  const row = rows.find((item) => item.productId === sale.lines[0].productId);
  assert.ok(row);
  assert.equal(row!.units, sale.lines[0].quantity - 1);
});
