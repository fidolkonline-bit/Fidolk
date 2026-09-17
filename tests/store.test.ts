import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
test("persistent repository serializes competing sales, rolls back failures, and deduplicates retries", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "fido-test-"));
  process.env.FIDO_DATA_DIR = dir;
  delete process.env.DATABASE_URL;
  const { mutateWorkspace, readWorkspace } = await import("../lib/store");
  try {
    const action = {
      type: "createSale",
      payload: {
        customerId: "cust-walkin",
        items: [{ productId: "prod-3", quantity: 2 }],
        paid: 900000,
        method: "Cash",
      },
      requestId: randomUUID(),
    };
    const results = await Promise.allSettled([
      mutateWorkspace(action),
      mutateWorkspace({ ...action, requestId: randomUUID() }),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    let state = await readWorkspace();
    assert.equal(state.data.products.find((x) => x.id === "prod-3")!.stock, 1);
    assert.equal(state.data.sales.length, 6);
    await mutateWorkspace(action);
    state = await readWorkspace();
    assert.equal(state.data.sales.length, 6);
    await assert.rejects(
      mutateWorkspace({ ...action, payload: { ...action.payload, paid: 1 } }),
      /already used/,
    );
    const before = JSON.stringify(state.data);
    await assert.rejects(
      mutateWorkspace({
        type: "createSale",
        payload: {
          customerId: "cust-walkin",
          items: [{ productId: "prod-2", quantity: 1 }],
          paid: 99999999,
          method: "Cash",
        },
        requestId: randomUUID(),
      }),
    );
    assert.equal(JSON.stringify((await readWorkspace()).data), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
