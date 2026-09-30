import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import { quoteSale } from "../lib/pricing";
import { saleBalance } from "../lib/customers";
import type { Workspace } from "../lib/types";

const run = (
  workspace: Workspace,
  type: string,
  payload: Record<string, unknown>,
) => applyAction(workspace, { type, payload, requestId: randomUUID() });

const options = { allowTier: true, allowDiscount: true, allowOverride: true };

function withTwoLots() {
  const s = createSeed();
  const older = s.batches.find((b) => b.productId === "prod-2")!;
  older.receivedAt = "2026-08-01T00:00:00.000Z";
  older.remaining = 3;
  const newer = {
    ...structuredClone(older),
    id: "batch-prod-2-newer",
    lot: "L-NEW",
    receivedAt: "2026-09-20T00:00:00.000Z",
    remaining: 10,
    quantity: 10,
  };
  s.batches.push(newer);
  s.products.find((p) => p.id === "prod-2")!.stock = 13;
  return { s, older, newer };
}

test("the cashier's chosen lot is used instead of the oldest one", () => {
  const { s, older, newer } = withTwoLots();
  const oldest = quoteSale(s, [{ productId: "prod-2", quantity: 1 }], options);
  assert.equal(oldest.lines[0].lot, older.lot);
  const chosen = quoteSale(
    s,
    [{ productId: "prod-2", quantity: 2, batchId: newer.id }],
    options,
  );
  assert.equal(chosen.lines.length, 1);
  assert.equal(chosen.lines[0].lot, "L-NEW");
  assert.equal(chosen.lines[0].batchAllocations[0].batchId, newer.id);
});

test("a short lot is refused with the count left, and a split across lots works", () => {
  const { s, older, newer } = withTwoLots();
  assert.throws(
    () =>
      quoteSale(
        s,
        [{ productId: "prod-2", quantity: 5, batchId: older.id }],
        options,
      ),
    /Only 3 left in lot/,
  );
  const split = quoteSale(
    s,
    [
      { productId: "prod-2", quantity: 3, batchId: older.id },
      { productId: "prod-2", quantity: 2, batchId: newer.id },
    ],
    options,
  );
  assert.deepEqual(
    split.lines.map((l) => [l.lot, l.quantity]),
    [
      [older.lot, 3],
      ["L-NEW", 2],
    ],
  );
  const otherLot = s.batches.find((b) => b.productId !== "prod-2")!;
  assert.throws(
    () =>
      quoteSale(
        s,
        [{ productId: "prod-2", quantity: 1, batchId: otherLot.id }],
        options,
      ),
    /does not belong/,
  );
});

test("old dues can be paid on the same bill as a new sale", () => {
  const s = createSeed();
  const open = s.sales.find(
    (sale) => sale.customerId === "cust-2" && saleBalance(sale) > 0,
  )!;
  const owed = saleBalance(open);
  const salesBefore = s.sales.length;
  run(s, "createSale", {
    customerId: "cust-2",
    items: [{ productId: "prod-2", quantity: 1 }],
    method: "Cash",
    duesPayment: owed,
  });
  assert.equal(saleBalance(open), 0);
  assert.equal(open.status, "Paid");
  const created = s.sales.at(-1)!;
  assert.equal(s.sales.length, salesBefore + 1);
  assert.equal(created.status, "Paid");
  assert.equal(created.paid, created.total);
  for (const entry of s.journal)
    assert.equal(
      entry.lines.reduce((n, l) => n + l.debit - l.credit, 0),
      0,
    );
});

test("dues on the bill need a named customer, a real payment and no overpayment", () => {
  const sale = (payload: Record<string, unknown>) =>
    run(createSeed(), "createSale", {
      items: [{ productId: "prod-2", quantity: 1 }],
      ...payload,
    });
  assert.throws(
    () =>
      sale({ customerId: "cust-walkin", method: "Cash", duesPayment: 1000 }),
    /named customer/,
  );
  assert.throws(
    () =>
      sale({
        customerId: "cust-2",
        method: "Credit",
        paid: 0,
        duesPayment: 1000,
      }),
    /old balance/,
  );
  assert.throws(
    () =>
      sale({ customerId: "cust-2", method: "Cash", duesPayment: 999999999 }),
    /exceeds/,
  );
});

test("reloads ride on the same bill as items and use the bill's payment", () => {
  const s = createSeed();
  run(s, "addReload", { provider: "Dialog", type: "Top-up", amount: 500000 });
  const reloadsBefore = s.reloads.length;
  run(s, "createSale", {
    customerId: "cust-walkin",
    items: [{ productId: "prod-2", quantity: 1 }],
    method: "Cash",
    reloads: [
      {
        provider: "Dialog",
        type: "Reload",
        phone: "0775550142",
        amount: 50000,
      },
    ],
  });
  assert.equal(s.reloads.length, reloadsBefore + 1);
  assert.equal(s.reloads.at(-1)!.amount, 50000);
  for (const entry of s.journal)
    assert.equal(
      entry.lines.reduce((n, l) => n + l.debit - l.credit, 0),
      0,
    );
});

test("bill reloads refuse credit, top-ups and an empty wallet", () => {
  const sale = (reload: Record<string, unknown>, method = "Cash") =>
    run(createSeed(), "createSale", {
      customerId: "cust-2",
      items: [{ productId: "prod-2", quantity: 1 }],
      method,
      paid: method === "Credit" ? 0 : undefined,
      reloads: [{ provider: "Dialog", phone: "0775550142", ...reload }],
    });
  assert.throws(
    () => sale({ type: "Reload", amount: 1000 }),
    /balance is too low/,
  );
  assert.throws(() => sale({ type: "Top-up", amount: 1000 }), /Reloads page/);
  assert.throws(
    () => sale({ type: "Reload", amount: 1000 }, "Credit"),
    /Reloads are paid now/,
  );
});
