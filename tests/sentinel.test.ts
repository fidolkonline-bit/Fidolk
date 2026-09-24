import test from "node:test";
import assert from "node:assert/strict";
import { runStoreSentinel } from "../lib/sentinel";
import type { Workspace } from "../lib/types";

test("runStoreSentinel flags cycle count shrinkage", () => {
  const mockWorkspace = {
    inventoryCounts: [
      {
        id: "cnt-1",
        number: "CNT-001",
        status: "Approved",
        lines: [
          {
            productId: "prod-1",
            productName: "iPhone 13 Tempered Glass",
            expected: 20,
            counted: 15, // 5 missing!
            unitCost: 100000, // Rs. 1,000 cost each = Rs. 5,000 loss
          },
        ],
        createdByName: "Cashier A",
        approvedByName: "Manager B",
      },
    ],
    sales: [],
    returns: [],
    inventoryMovements: [],
  } as unknown as Workspace;

  const report = runStoreSentinel(mockWorkspace);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].category, "Shrinkage");
  assert.ok(report.findings[0].title.includes("Stock count variance shortage"));
  assert.equal(report.totalShrinkageValue, 500000);
});

test("runStoreSentinel detects cashier return spikes", () => {
  const mockWorkspace = {
    inventoryCounts: [],
    sales: [
      { id: "sale-1", staffId: "staff-x", staffName: "Kasun" },
      { id: "sale-2", staffId: "staff-x", staffName: "Kasun" },
      { id: "sale-3", staffId: "staff-x", staffName: "Kasun" },
    ],
    returns: [
      { saleId: "sale-1", total: 400000 },
      { saleId: "sale-2", total: 500000 },
      { saleId: "sale-3", total: 600000 },
    ],
    inventoryMovements: [],
  } as unknown as Workspace;

  const report = runStoreSentinel(mockWorkspace);
  const fraudFinding = report.findings.find(
    (f) => f.category === "Cashier Fraud",
  );
  assert.ok(fraudFinding !== undefined);
  assert.equal(fraudFinding.severity, "High");
  assert.ok(fraudFinding.title.includes("Kasun"));
});

test("runStoreSentinel detects off-hours stock write-offs", () => {
  const mockWorkspace = {
    inventoryCounts: [],
    sales: [],
    returns: [],
    inventoryMovements: [
      {
        id: "mov-1",
        type: "Loss",
        createdAt: "2026-09-24T22:30:00.000Z", // 10:30 PM Colombo
        actorName: "Night Staff",
      },
    ],
  } as unknown as Workspace;

  const report = runStoreSentinel(mockWorkspace);
  const offHourFinding = report.findings.find(
    (f) => f.category === "Off-Hours Activity",
  );
  assert.ok(offHourFinding !== undefined);
  assert.equal(offHourFinding.severity, "Medium");
});
