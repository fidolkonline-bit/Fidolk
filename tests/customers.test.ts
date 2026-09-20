import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import {
  allocateCustomerPayment,
  canonicalSriLankanPhone,
  customerFinancialSummary,
  customerMatches,
  customerOpenInvoices,
} from "../lib/customers";
import { createSeed } from "../lib/seed";
import type { Sale, Workspace } from "../lib/types";

const run = (
  workspace: Workspace,
  type: string,
  payload: Record<string, unknown>,
) => applyAction(workspace, { type, payload, requestId: randomUUID() });

test("Sri Lankan customer phones are stored and compared canonically", () => {
  assert.equal(canonicalSriLankanPhone("077 123-4567"), "+94771234567");
  assert.equal(canonicalSriLankanPhone("94771234567"), "+94771234567");
  assert.equal(canonicalSriLankanPhone("+94 77 123 4567"), "+94771234567");
  assert.equal(canonicalSriLankanPhone("123"), "");
  assert.equal(
    customerMatches(
      { id: "customer", name: "Nethmi Silva", phone: "+94712345678" },
      "0712",
    ),
    true,
  );
  const workspace = createSeed();
  assert.throws(
    () =>
      run(workspace, "createCustomer", {
        name: "Duplicate Kasun",
        phone: "+94 77 123 4567",
      }),
    /already exists/,
  );
  run(workspace, "createCustomer", {
    name: "New customer",
    phone: "075 222 3344",
    address: "Colombo",
  });
  assert.equal(workspace.customers.at(-1)?.phone, "+94752223344");
});

test("customer payment allocation is deterministic and supports partial allocation", () => {
  const invoices = [
    {
      id: "new",
      number: "INV-2",
      total: 1000,
      paid: 0,
      createdAt: "2026-02-01",
      dueDate: "2026-03-01",
    },
    {
      id: "old",
      number: "INV-1",
      total: 800,
      paid: 200,
      createdAt: "2026-01-01",
      dueDate: "2026-02-01",
    },
  ] as Sale[];
  const sorted = [...invoices].sort((a, b) =>
    (a.dueDate || "").localeCompare(b.dueDate || ""),
  );
  assert.deepEqual(allocateCustomerPayment(sorted, 900), [
    { saleId: "old", number: "INV-1", amount: 600 },
    { saleId: "new", number: "INV-2", amount: 300 },
  ]);
});

test("consolidated payment allocates oldest first, updates statuses, and balances journal", () => {
  const workspace = createSeed();
  const original = workspace.sales.find(
    (sale) => sale.customerId === "cust-2",
  )!;
  original.createdAt = "2026-01-10T00:00:00.000Z";
  original.dueDate = "2026-02-10";
  const newer: Sale = {
    ...structuredClone(original),
    id: "sale-new-credit",
    number: "INV-00999",
    createdAt: "2026-02-10T00:00:00.000Z",
    dueDate: "2026-03-10",
    total: 500000,
    paid: 100000,
    status: "Partial",
    payments: [{ amount: 100000, method: "Cash" }],
  };
  workspace.sales.push(newer);
  run(workspace, "collectCustomerPayment", {
    customerId: "cust-2",
    amount: 340000,
    method: "Card",
  });
  assert.equal(original.paid, original.total);
  assert.equal(original.status, "Paid");
  assert.equal(newer.paid, 200000);
  assert.equal(newer.status, "Partial");
  const entry = workspace.journal.at(-1)!;
  assert.equal(
    entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0),
    0,
  );
  assert.match(entry.description, /INV-00003/);
  assert.match(entry.description, /INV-00999/);
});

test("consolidated payment rejects overpayment and excludes returned and active COD invoices", () => {
  const workspace = createSeed();
  const open = workspace.sales.find((sale) => sale.customerId === "cust-2")!;
  assert.throws(
    () =>
      run(workspace, "collectCustomerPayment", {
        customerId: "cust-2",
        amount: open.total - open.paid + 1,
        method: "Cash",
      }),
    /exceeds/,
  );
  open.status = "Returned";
  assert.equal(
    customerOpenInvoices("cust-2", workspace.sales, workspace.shipments).length,
    0,
  );
  open.status = "Partial";
  workspace.shipments.push({
    id: "shipment-active",
    orderRef: open.number,
    customerName: open.customerName,
    tracking: "TRACK-1",
    amount: open.total - open.paid,
    postage: 0,
    status: "Shipped",
    date: "2026-02-01",
    collected: 0,
  });
  assert.equal(
    customerOpenInvoices("cust-2", workspace.sales, workspace.shipments).length,
    0,
  );
  const summary = customerFinancialSummary(
    workspace.customers.find((customer) => customer.id === "cust-2")!,
    workspace.sales,
    workspace.shipments,
  );
  assert.equal(summary.outstanding, open.total - open.paid);
  assert.equal(summary.openInvoices.length, 1);
  assert.equal(summary.collectibleOutstanding, 0);
  assert.equal(summary.collectibleInvoices.length, 0);
  assert.throws(
    () =>
      run(workspace, "collectCustomerPayment", {
        customerId: "cust-2",
        amount: 1,
        method: "Cash",
      }),
    /no eligible/,
  );
});
