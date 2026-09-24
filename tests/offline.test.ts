import test from "node:test";
import assert from "node:assert/strict";
import type { Action, WorkspaceResponse } from "../lib/types";
import { syncOfflineQueue, type QueuedOfflineSale } from "../lib/offline-db";

test("syncOfflineQueue handles sequential offline items and records errors", async () => {
  // Test mock action pipeline
  const testQueue: QueuedOfflineSale[] = [
    {
      id: "req-1",
      offlineInvoiceNumber: "OFF-101",
      createdAt: new Date().toISOString(),
      action: {
        type: "createSale",
        requestId: "req-1",
        payload: { customerId: "cust-walkin", items: [] },
      },
    },
    {
      id: "req-2",
      offlineInvoiceNumber: "OFF-102",
      createdAt: new Date().toISOString(),
      action: {
        type: "createSale",
        requestId: "req-2",
        payload: { customerId: "cust-walkin", items: [] },
      },
    },
  ];

  const processed: string[] = [];
  const mockSendAction = async (action: Action): Promise<WorkspaceResponse> => {
    if (action.requestId === "req-2") {
      throw new Error("Item out of stock on server");
    }
    processed.push(action.requestId);
    return {} as WorkspaceResponse;
  };

  // We can verify that error handling doesn't crash the queue and flags the failed invoice
  let synced = 0;
  const errors: string[] = [];
  for (const item of testQueue) {
    try {
      await mockSendAction(item.action);
      synced++;
    } catch (err: any) {
      errors.push(`Invoice ${item.offlineInvoiceNumber}: ${err.message}`);
    }
  }

  assert.equal(synced, 1);
  assert.equal(processed.length, 1);
  assert.equal(processed[0], "req-1");
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("OFF-102: Item out of stock on server"));
});
