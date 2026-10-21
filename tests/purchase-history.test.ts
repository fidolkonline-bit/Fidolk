import { test } from "node:test";
import assert from "node:assert/strict";
import { costChange, purchaseHistory } from "../lib/purchase-history";
import type { Batch, PurchaseOrder } from "../lib/types";

const lot = (
  lotNo: string,
  supplier: string,
  unitCost: number,
  quantity: number,
  receivedAt: string,
  productId = "p1",
): Batch => ({
  id: lotNo,
  productId,
  lot: lotNo,
  supplier,
  quantity,
  remaining: quantity,
  unitCost,
  receivedAt,
  imeis: [],
});

const order = (
  number: string,
  status: PurchaseOrder["status"],
  ordered: number,
  received: number,
): PurchaseOrder => ({
  id: number,
  number,
  supplierId: "s1",
  supplierName: "Tech Hub",
  lines: [
    { productId: "p1", productName: "Glass", ordered, received, unitCost: 1 },
  ],
  subtotal: 0,
  discount: 0,
  total: 0,
  dueDate: "2026-11-01",
  status,
  createdAt: "2026-10-01T00:00:00.000Z",
});

test("history lists past deliveries newest first with last, lowest and average cost", () => {
  const h = purchaseHistory(
    "p1",
    [
      lot("A", "Tech Hub", 10000, 10, "2026-08-01T00:00:00.000Z"),
      lot("B", "Mobile World", 9000, 30, "2026-09-01T00:00:00.000Z"),
      lot("C", "Tech Hub", 12000, 10, "2026-10-01T00:00:00.000Z"),
      lot("X", "Tech Hub", 1, 1, "2026-10-05T00:00:00.000Z", "other"),
    ],
    [],
    " tech hub ",
  );
  assert.deepEqual(
    h.receipts.map((r) => r.lot),
    ["C", "B", "A"],
  );
  assert.equal(h.last?.lot, "C");
  assert.equal(h.lastFromSupplier?.lot, "C");
  assert.equal(h.lowest?.supplier, "Mobile World");
  assert.equal(h.averageCost, 9800);
});

test("history counts only what is still to arrive on open orders", () => {
  const h = purchaseHistory(
    "p1",
    [],
    [
      order("PO-1", "Ordered", 5, 0),
      order("PO-2", "Partially received", 10, 4),
      order("PO-3", "Received", 3, 3),
      order("PO-4", "Cancelled", 8, 0),
    ],
  );
  assert.equal(h.onOrder, 11);
  assert.deepEqual(h.openOrders, ["PO-1", "PO-2"]);
  assert.equal(h.last, undefined);
  assert.equal(h.averageCost, undefined);
});

test("cost change is a rounded percent against the earlier cost", () => {
  assert.equal(costChange(11000, 10000), 10);
  assert.equal(costChange(9500, 10000), -5);
  assert.equal(costChange(10000, undefined), undefined);
  assert.equal(costChange(0, 10000), undefined);
});
