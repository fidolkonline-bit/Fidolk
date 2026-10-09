import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import { customerOpenInvoices, saleBalance } from "../lib/customers";
import { reportTotals } from "../lib/reports";
import type { AuthUser, Workspace } from "../lib/types";

const owner: AuthUser = {
  id: "user-owner",
  name: "Owner",
  username: "owner",
  role: "Owner",
  permissions: ["*"],
  active: true,
};
const counter: AuthUser = {
  id: "user-counter",
  name: "Kasun",
  username: "kasun",
  role: "Sales",
  permissions: ["reloads.manage"],
  active: true,
};
const run = (
  s: Workspace,
  type: string,
  payload: Record<string, unknown>,
  actor = counter,
) =>
  applyAction(
    s,
    { type, payload, requestId: randomUUID() },
    new Date().toISOString(),
    actor,
  );
const balanced = (s: Workspace) => {
  for (const entry of s.journal)
    assert.equal(
      entry.lines.reduce((n, l) => n + l.debit - l.credit, 0),
      0,
      entry.description,
    );
};
const account = (s: Workspace, name: string) =>
  s.journal
    .flatMap((j) => j.lines)
    .filter((l) => l.account === name)
    .reduce((n, l) => n + l.debit - l.credit, 0);

function withWallet() {
  const s = createSeed();
  run(s, "addReload", { provider: "Dialog", type: "Top-up", amount: 500000 });
  return s;
}
function send(s: Workspace, payload: Record<string, unknown> = {}) {
  run(
    s,
    "sendReloadRequest",
    { customerId: "cust-1", phone: "0771234567", amount: 50000, ...payload },
    owner,
  );
  return s.reloadRequests.at(-1)!;
}

test("owner sends a reload; the counter sees it and does it for cash", () => {
  const s = withWallet();
  const request = send(s, { note: "Urgent" });
  assert.equal(request.status, "Sent");
  assert.equal(request.number, "REQ-00001");
  assert.equal(request.requestedById, owner.id);

  run(s, "seeReloadRequest", { id: request.id });
  assert.equal(request.status, "Seen");
  assert.equal(request.seenByName, "Kasun");

  const salesBefore = s.sales.length;
  const cashBefore = account(s, "Cash");
  run(s, "completeReloadRequest", {
    id: request.id,
    provider: "Dialog",
    method: "Cash",
  });
  assert.equal(request.status, "Done");
  const sale = s.sales.at(-1)!;
  assert.equal(s.sales.length, salesBefore + 1);
  assert.equal(request.saleId, sale.id);
  assert.equal(sale.lines.length, 0);
  assert.equal(sale.total, 50000);
  assert.equal(sale.status, "Paid");
  assert.equal(sale.reloads?.[0].phone, "0771234567");
  const reload = s.reloads.at(-1)!;
  assert.equal(reload.requestId, request.id);
  assert.equal(reload.type, "Reload");
  assert.equal(account(s, "Cash") - cashBefore, 50000);
  balanced(s);

  const text = s.sms.at(-1)!;
  assert.match(text.message, /Dialog reload LKR 500\.00 to 0771234567/);
  assert.match(text.message, new RegExp(sale.number));
  const note = s.notifications[0];
  assert.equal(note.recipientUserId, owner.id);
  assert.equal(note.title, "Reload done");
});

test("a credit reload becomes a customer due and is paid off later", () => {
  const s = withWallet();
  const request = send(s);
  run(s, "completeReloadRequest", {
    id: request.id,
    provider: "Dialog",
    method: "Credit",
    dueDate: "2099-01-31",
  });
  const sale = s.sales.at(-1)!;
  assert.equal(sale.status, "Credit");
  assert.equal(sale.dueDate, "2099-01-31");
  assert.equal(saleBalance(sale), 50000);
  assert.ok(
    customerOpenInvoices("cust-1", s.sales, s.shipments).some(
      (x) => x.id === sale.id,
    ),
  );
  assert.equal(account(s, "Accounts receivable") >= 50000, true);
  assert.match(s.sms.at(-1)!.message, /On credit, due 2099-01-31/);
  balanced(s);

  run(
    s,
    "collectPayment",
    { saleId: sale.id, amount: 50000, method: "Cash" },
    owner,
  );
  assert.equal(saleBalance(sale), 0);
  balanced(s);
});

test("a request can't be done twice, and a walk-in can't take credit", () => {
  const s = withWallet();
  const request = send(s);
  run(s, "completeReloadRequest", { id: request.id, provider: "Dialog" });
  const walletAfter = s.reloads.length;
  assert.throws(
    () =>
      run(s, "completeReloadRequest", { id: request.id, provider: "Dialog" }),
    /already done/,
  );
  assert.equal(s.reloads.length, walletAfter);

  const walkIn = send(s, { customerId: "cust-walkin" });
  assert.throws(
    () =>
      run(s, "completeReloadRequest", {
        id: walkIn.id,
        provider: "Dialog",
        method: "Credit",
      }),
    /named customer/,
  );
});

test("an empty wallet stops the reload; the counter can say why", () => {
  const s = createSeed();
  const request = send(s);
  assert.throws(
    () =>
      run(s, "completeReloadRequest", { id: request.id, provider: "Dialog" }),
    /balance is too low/,
  );
  run(s, "declineReloadRequest", {
    id: request.id,
    reason: "Dialog wallet empty",
  });
  assert.equal(request.status, "Can't do");
  assert.equal(s.notifications[0].title, "Reload not done");
  assert.throws(
    () =>
      run(s, "completeReloadRequest", { id: request.id, provider: "Dialog" }),
    /can't do/,
  );
});

test("quick add makes a new customer, or reuses one with the same number", () => {
  const s = withWallet();
  const before = s.customers.length;
  const request = send(s, {
    customerId: undefined,
    customerName: "Nimal",
    customerPhone: "0719876543",
  });
  assert.equal(s.customers.length, before + 1);
  assert.equal(request.customerName, "Nimal");
  send(s, {
    customerId: undefined,
    customerName: "Nimal again",
    customerPhone: "+94719876543",
  });
  assert.equal(s.customers.length, before + 1);
  assert.equal(s.reloadRequests.at(-1)!.customerId, request.customerId);
});

test("packages need a name and are recorded as packages", () => {
  const s = withWallet();
  assert.throws(() => send(s, { type: "Package" }), /Package name/);
  const request = send(s, { type: "Package", packageName: "Anytime 50GB" });
  run(s, "completeReloadRequest", { id: request.id, provider: "Dialog" });
  assert.equal(s.reloads.at(-1)!.type, "Package");
  assert.equal(s.reloads.at(-1)!.packageName, "Anytime 50GB");
  assert.match(s.sms.at(-1)!.message, /Dialog Anytime 50GB/);
});

test("cancelled requests close, and reload invoices stay out of sales revenue and returns", () => {
  const s = withWallet();
  const cancelled = send(s);
  run(s, "cancelReloadRequest", { id: cancelled.id }, owner);
  assert.equal(cancelled.status, "Cancelled");

  const day = new Date().toISOString().slice(0, 10);
  const filters = { from: day, to: day };
  const revenueBefore = reportTotals(s, filters).invoiceRevenue;
  const request = send(s);
  run(s, "completeReloadRequest", { id: request.id, provider: "Dialog" });
  assert.equal(reportTotals(s, filters).invoiceRevenue, revenueBefore);
  assert.throws(
    () =>
      run(
        s,
        "returnSale",
        { saleId: request.saleId, disposition: "Restock", reason: "x" },
        owner,
      ),
    /can't be returned/,
  );
});
