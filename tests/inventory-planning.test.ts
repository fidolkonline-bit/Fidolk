import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../lib/seed";
import { inventoryPlan } from "../lib/inventory-planning";

test("inventory planning accounts for incoming stock and sales velocity", () => {
  const s = createSeed();
  const product = s.products[0];
  const row = inventoryPlan(s, {
    asOf: "2026-09-18T00:00:00.000Z",
    lookbackDays: 30,
    targetDays: 30,
  }).find((item) => item.productId === product.id)!;
  assert.ok(row);
  assert.ok(row.stockValue >= 0);
  assert.ok(row.suggestedOrder >= 0);
});

test("inventory planning labels products without history", () => {
  const s = createSeed();
  s.sales = [];
  const rows = inventoryPlan(s, { asOf: "2026-09-18T00:00:00.000Z" });
  assert.ok(rows.every((row) => row.urgency === "No history"));
});
