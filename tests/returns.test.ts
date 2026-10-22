import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import {
  defaultRefundMethod,
  lineRefund,
  returnedUnits,
  settleReturn,
} from "../lib/returns";
import type { Workspace } from "../lib/types";
import { withLots } from "./lots-helper";

const run = (s: Workspace, type: string, payload: Record<string, unknown>) =>
  applyAction(s, {
    type,
    payload: withLots(s, type, payload),
    requestId: randomUUID(),
  });

const lastEntry = (s: Workspace) => s.journal.at(-1)!.lines;
const credited = (s: Workspace, account: string) =>
  lastEntry(s)
    .filter((line) => line.account === account)
    .reduce((sum, line) => sum + line.credit, 0);

function cardSale(s: Workspace) {
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 2 }],
    paid: 240000,
    method: "Card",
  });
  return s.sales.at(-1)!;
}

test("a refund goes back the way the bill was paid unless staff choose otherwise", () => {
  const s = createSeed();
  const sale = cardSale(s);
  assert.equal(defaultRefundMethod(sale), "Card");
  run(s, "returnItems", {
    saleId: sale.id,
    items: [{ lineIndex: 0, quantity: 1, disposition: "Restock" }],
    resolution: "Refund",
    reason: "Changed mind",
  });
  assert.equal(s.returns.at(-1)!.refundMethod, "Card");
  assert.equal(credited(s, "Bank"), 120000);
  assert.equal(credited(s, "Cash"), 0);

  run(s, "returnItems", {
    saleId: sale.id,
    items: [{ lineIndex: 0, quantity: 1, disposition: "Restock" }],
    resolution: "Refund",
    refundMethod: "Cash",
    reason: "Card machine down",
  });
  assert.equal(s.returns.at(-1)!.refundMethod, "Cash");
  assert.equal(credited(s, "Cash"), 120000);
  assert.equal(credited(s, "Bank"), 0);
});

test("only cash, card or bank transfer can pay out a refund", () => {
  const s = createSeed();
  const sale = cardSale(s);
  assert.throws(() =>
    run(s, "returnItems", {
      saleId: sale.id,
      items: [{ lineIndex: 0, quantity: 1, disposition: "Restock" }],
      resolution: "Refund",
      refundMethod: "Credit",
      reason: "Wrong",
    }),
  );
});

test("store credit and exchanges record no refund method", () => {
  const s = createSeed();
  const sale = cardSale(s);
  run(s, "returnItems", {
    saleId: sale.id,
    items: [{ lineIndex: 0, quantity: 1, disposition: "Restock" }],
    resolution: "Store credit",
    refundMethod: "Cash",
    reason: "Will pick something else",
  });
  assert.equal(s.returns.at(-1)!.refundMethod, undefined);
  assert.equal(credited(s, "Cash"), 0);
});

test("the on-screen refund matches what the return records, discounts and dues included", () => {
  const s = createSeed();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 3 }],
    discount: 10001,
    paid: 200000,
    method: "Cash",
  });
  const sale = s.sales.at(-1)!;
  for (const quantity of [1, 2]) {
    const previous = s.returns.filter((r) => r.saleId === sale.id);
    const already = returnedUnits(previous, 0);
    const total = lineRefund(sale, 0, already, quantity);
    const shown = settleReturn(sale, previous, total);
    run(s, "returnItems", {
      saleId: sale.id,
      items: [{ lineIndex: 0, quantity, disposition: "Restock" }],
      resolution: "Refund",
      reason: "Return",
    });
    assert.equal(s.returns.at(-1)!.total, total);
    assert.equal(credited(s, "Accounts receivable"), shown.owedCancelled);
    assert.equal(credited(s, "Cash"), shown.payout);
  }
  // Everything paid back or cancelled adds up to the bill after discount.
  assert.equal(
    s.returns
      .filter((r) => r.saleId === sale.id)
      .reduce((sum, r) => sum + r.total, 0),
    sale.total,
  );
});
