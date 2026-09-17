import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import type { Workspace } from "../lib/types";
const run = (s: Workspace, type: string, payload: Record<string, unknown>) =>
  applyAction(s, { type, payload, requestId: randomUUID() });
function balanced(s: Workspace) {
  for (const j of s.journal)
    assert.equal(
      j.lines.reduce((a, l) => a + l.debit - l.credit, 0),
      0,
      j.description,
    );
}
test("sale consumes actual FIFO cost and creates balanced entries", () => {
  const s = createSeed();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 2 }],
    discount: 0,
    paid: 120000,
    method: "Cash",
  });
  const x = s.sales.at(-1)!;
  assert.equal(x.total, 240000);
  assert.equal(x.cost, 180000);
  assert.equal(x.paid, 120000);
  assert.equal(x.status, "Partial");
  assert.equal(s.products[1].stock, 22);
  balanced(s);
});
test("phone sale requires the matching available IMEI", () => {
  const s = createSeed();
  assert.throws(
    () =>
      run(structuredClone(s), "createSale", {
        customerId: "cust-1",
        items: [{ productId: "prod-1", quantity: 1, imei: "invalid" }],
        paid: 18990000,
        method: "Cash",
      }),
    /unavailable/,
  );
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-1", quantity: 1, imei: "356789012340001" }],
    paid: 18990000,
    method: "Cash",
  });
  assert.equal(s.products[0].stock, 3);
  assert.equal(s.batches[0].imeis.length, 3);
  balanced(s);
});
test("commission uses profit and confirmed pool split, never selling price", () => {
  const s = createSeed();
  s.settings.commissionConfirmed = true;
  run(s, "createSale", {
    customerId: "cust-walkin",
    items: [{ productId: "prod-2", quantity: 1 }],
    paid: 120000,
    method: "Cash",
    agent: true,
  });
  const sale = s.sales.at(-1)!;
  assert.equal(sale.commission, 300);
  assert.equal(sale.agentCommission, 300);
  balanced(s);
});
test("overpayment, anonymous credit and excess stock are rejected", () => {
  const s = createSeed();
  const base = {
    customerId: "cust-walkin",
    items: [{ productId: "prod-2", quantity: 1 }],
    method: "Cash",
  };
  assert.throws(
    () => run(structuredClone(s), "createSale", { ...base, paid: 120001 }),
    /exceed/,
  );
  assert.throws(
    () => run(structuredClone(s), "createSale", { ...base, paid: 0 }),
    /named customer/,
  );
  assert.throws(
    () =>
      run(structuredClone(s), "createSale", {
        ...base,
        items: [{ productId: "prod-2", quantity: 100 }],
      }),
    /Insufficient/,
  );
});
test("repair requires approval and pays commission on completion not collection", () => {
  const s = createSeed();
  assert.throws(
    () =>
      run(s, "repairStatus", {
        id: "repair-1",
        status: "Ready for collection",
      }),
    /Cannot/,
  );
  run(s, "repairStatus", {
    id: "repair-1",
    status: "Approved",
    approvalMethod: "Customer approved by phone",
  });
  run(s, "repairStatus", { id: "repair-1", status: "In progress" });
  run(s, "repairStatus", { id: "repair-1", status: "Ready for collection" });
  const r = s.repairs[0];
  assert.equal(r.commission, 175000);
  assert.equal(r.paid, 0);
  assert.equal(s.products.find((p) => p.id === "prod-8")!.stock, 1);
  balanced(s);
});
test("supplier cheque affects bank only on clearance and cannot clear twice", () => {
  const s = createSeed();
  run(s, "receiveStock", {
    productId: "prod-2",
    supplier: "Supplier",
    quantity: 2,
    unitCost: 90000,
    lot: "TEST-1",
    paid: 0,
  });
  const purchase = s.purchases.at(-1)!;
  const count = s.journal.length;
  run(s, "addCheque", {
    number: "123",
    supplier: "Supplier",
    amount: 180000,
    dueDate: "2026-10-01",
    purchaseId: purchase.id,
  });
  assert.equal(s.journal.length, count);
  run(s, "chequeStatus", { id: s.cheques[0].id, status: "Cleared" });
  assert.equal(purchase.paid, 180000);
  assert.throws(
    () => run(s, "chequeStatus", { id: s.cheques[0].id, status: "Cleared" }),
    /transition/,
  );
  balanced(s);
});
test("COD transfers receivable and settles invoice without duplicate revenue", () => {
  const s = createSeed();
  const sale = s.sales.find((x) => x.status === "Partial")!;
  run(s, "addShipment", {
    orderRef: sale.number,
    customerName: sale.customerName,
    tracking: "TEST",
    amount: 240000,
    postage: 35000,
  });
  for (const status of ["Shipped", "Delivered", "Collected"])
    run(s, "shipmentStatus", { id: s.shipments[0].id, status });
  assert.equal(sale.status, "Paid");
  assert.equal(sale.paid, sale.total);
  balanced(s);
});
test("salary advances recovered once and monthly payroll cannot duplicate", () => {
  const s = createSeed();
  run(s, "staffAdvance", { id: "staff-1", amount: 500000 });
  run(s, "payroll", { id: "staff-1" });
  assert.equal(s.staff[0].advances, 0);
  assert.throws(() => run(s, "payroll", { id: "staff-1" }), /already/);
  balanced(s);
});
test("unconfirmed provider top-up bonus is not immediately counted as revenue", () => {
  const s = createSeed();
  run(s, "addReload", {
    provider: "Mobitel",
    type: "Top-up",
    amount: 1000000,
    commission: 40000,
  });
  const j = s.journal.at(-1)!;
  assert.ok(
    j.lines.some(
      (l) =>
        l.account === "Provider bonus pending allocation" && l.credit === 40000,
    ),
  );
  balanced(s);
});
test("full return refunds only paid amount, restores batches and reverses commission", () => {
  const s = createSeed();
  s.settings.commissionConfirmed = true;
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 1 }],
    paid: 60000,
    method: "Cash",
  });
  const sale = s.sales.at(-1)!;
  run(s, "returnSale", {
    saleId: sale.id,
    disposition: "Restock",
    reason: "Wrong model",
  });
  assert.equal(sale.returnInfo?.refund, 60000);
  assert.equal(sale.status, "Returned");
  assert.equal(sale.commission, 0);
  assert.equal(s.products[1].stock, 24);
  assert.throws(
    () =>
      run(s, "collectPayment", { saleId: sale.id, amount: 1, method: "Cash" }),
    /returned/,
  );
  balanced(s);
});
test("written-off return does not reappear in saleable stock", () => {
  const s = createSeed();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 1 }],
    paid: 120000,
    method: "Cash",
  });
  run(s, "returnSale", {
    saleId: s.sales.at(-1)!.id,
    disposition: "Waste",
    reason: "Broken",
  });
  assert.equal(s.products[1].stock, 23);
  assert.ok(
    s.journal
      .at(-1)!
      .lines.some(
        (l) => l.account === "Stock loss expense" && l.debit === 90000,
      ),
  );
  balanced(s);
});

test("partial returns restore only selected quantities and remain balanced", () => {
  const s = createSeed();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 3 }],
    paid: 360000,
    method: "Cash",
  });
  const sale = s.sales.at(-1)!;
  const before = s.products.find((p) => p.id === "prod-2")!.stock;
  run(s, "returnItems", {
    saleId: sale.id,
    items: [{ lineIndex: 0, quantity: 1, disposition: "Restock" }],
    resolution: "Refund",
    reason: "Customer selected the wrong model",
  });
  assert.equal(s.products.find((p) => p.id === "prod-2")!.stock, before + 1);
  assert.equal(s.returns.at(-1)!.total, 120000);
  assert.equal(sale.status, "Paid");
  assert.throws(
    () =>
      run(s, "returnItems", {
        saleId: sale.id,
        items: [{ lineIndex: 0, quantity: 3, disposition: "Restock" }],
        resolution: "Refund",
        reason: "Too many",
      }),
    /exceeds/,
  );
  balanced(s);
});

test("repair access detail is encrypted and cleared at collection", () => {
  const s = createSeed();
  run(s, "createRepair", {
    customerName: "Security Test",
    phone: "0771234567",
    device: "Android phone",
    issue: "Diagnostics",
    estimate: 100000,
    deviceAccessSecret: "1-2-3-6 pattern",
  });
  const repair = s.repairs.at(-1)!;
  assert.equal(repair.hasCredential, true);
  assert.ok(repair.credentialCiphertext);
  assert.equal(repair.credentialCiphertext!.includes("1-2-3-6"), false);
  for (const [status, extra] of [
    ["Diagnosing", {}],
    ["Awaiting approval", {}],
    ["Approved", { approvalMethod: "Phone call" }],
    ["In progress", {}],
    ["Ready for collection", {}],
    ["Collected", {}],
  ] as const)
    run(s, "repairStatus", { id: repair.id, status, ...extra });
  assert.equal(repair.hasCredential, false);
  assert.equal(repair.credentialCiphertext, undefined);
  balanced(s);
});

test("purchase orders support discounts and partial receipts", () => {
  const s = createSeed();
  run(s, "addSupplier", {
    name: "PO Supplier",
    phone: "0771234567",
    creditDays: 30,
    openingBalance: 0,
  });
  const supplier = s.suppliers.at(-1)!;
  run(s, "createPurchaseOrder", {
    supplierId: supplier.id,
    dueDate: "2026-10-30",
    discount: 10000,
    lines: [{ productId: "prod-2", quantity: 10, unitCost: 100000 }],
  });
  const order = s.purchaseOrders.at(-1)!;
  const before = s.products.find((p) => p.id === "prod-2")!.stock;
  run(s, "receivePurchaseOrder", {
    id: order.id,
    paid: 0,
    lines: [{ lineIndex: 0, quantity: 4, lot: "PO-PART-1", imeis: [] }],
  });
  assert.equal(order.status, "Partially received");
  assert.equal(s.products.find((p) => p.id === "prod-2")!.stock, before + 4);
  run(s, "receivePurchaseOrder", {
    id: order.id,
    paid: 0,
    lines: [{ lineIndex: 0, quantity: 6, lot: "PO-PART-2", imeis: [] }],
  });
  assert.equal(order.status, "Received");
  assert.equal(order.lines[0].received, 10);
  balanced(s);
});

test("credit reminders are scheduled once per configured overdue threshold", () => {
  const s = createSeed();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 1 }],
    paid: 0,
    method: "Credit",
    dueDate: "2026-09-01",
  });
  const before = s.sms.length;
  applyAction(
    s,
    { type: "processCreditReminders", payload: {}, requestId: randomUUID() },
    "2026-09-17T10:00:00.000Z",
  );
  assert.equal(s.sms.length, before + 1);
  applyAction(
    s,
    { type: "processCreditReminders", payload: {}, requestId: randomUUID() },
    "2026-09-17T11:00:00.000Z",
  );
  assert.equal(s.sms.length, before + 1);
});

test("sales commissions are attributed to the signed-in staff record", () => {
  const s = createSeed();
  s.settings.commissionConfirmed = true;
  applyAction(
    s,
    {
      type: "createSale",
      requestId: randomUUID(),
      payload: {
        customerId: "cust-walkin",
        items: [{ productId: "prod-2", quantity: 1 }],
        paid: 120000,
        method: "Cash",
      },
    },
    "2026-09-17T10:00:00.000Z",
    {
      id: "user-cashier",
      name: "Cashier user",
      username: "cashier",
      role: "Cashier",
      permissions: ["sales.manage"],
      active: true,
      staffId: "staff-2",
    },
  );
  assert.equal(s.sales.at(-1)!.staffId, "staff-2");
  assert.equal(s.sales.at(-1)!.staffName, "Cashier");
});
