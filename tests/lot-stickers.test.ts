import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import { lotBarcode, numberLots } from "../lib/lots";
import { quoteSale } from "../lib/pricing";
import { findProductByScannedSku, findScannedStock } from "../lib/product-scan";
import { normalizeWorkspace } from "../lib/store";
import type { Batch, Workspace } from "../lib/types";

const run = (
  workspace: Workspace,
  type: string,
  payload: Record<string, unknown>,
) => applyAction(workspace, { type, payload, requestId: randomUUID() });

const options = { allowTier: true, allowDiscount: true, allowOverride: true };

const lot = (
  id: string,
  productId: string,
  receivedAt: string,
  labelNo?: number,
): Batch => ({
  id,
  productId,
  lot: `L-${id}`,
  labelNo,
  supplier: "Test",
  quantity: 5,
  remaining: 5,
  unitCost: 100,
  receivedAt,
  imeis: [],
});

test("lots without a sticker number get one per product, oldest first", () => {
  const numbered = numberLots([
    lot("b", "p1", "2026-09-02T00:00:00.000Z"),
    lot("a", "p1", "2026-09-01T00:00:00.000Z"),
    lot("c", "p2", "2026-09-03T00:00:00.000Z"),
    lot("d", "p2", "2026-09-04T00:00:00.000Z", 4),
  ]);
  assert.deepEqual(
    numbered.map((b) => [b.id, b.labelNo]),
    [
      ["b", 2],
      ["a", 1],
      ["c", 5],
      ["d", 4],
    ],
  );
  const s = normalizeWorkspace(createSeed());
  assert.ok(s.batches.every((b) => b.labelNo! >= 1));
});

test("each new lot of a product gets the next sticker number", () => {
  const s = normalizeWorkspace(createSeed());
  const product = s.products.find((p) => !p.serialized)!;
  const highest = Math.max(
    ...s.batches
      .filter((b) => b.productId === product.id)
      .map((b) => b.labelNo!),
  );
  run(s, "receiveGoods", {
    supplier: "Tech Hub",
    paid: 0,
    lines: [
      { productId: product.id, quantity: 2, unitCost: 1000 },
      { productId: product.id, quantity: 3, unitCost: 1100 },
    ],
  });
  assert.deepEqual(
    s.batches.slice(-2).map((b) => b.labelNo),
    [highest + 1, highest + 2],
  );
});

test("a lot sticker names its product and lot; an old sticker only the product", () => {
  const s = normalizeWorkspace(createSeed());
  const batch = s.batches.find(
    (b) => !s.products.find((p) => p.id === b.productId)!.serialized,
  )!;
  const product = s.products.find((p) => p.id === batch.productId)!;
  const code = lotBarcode(product.sku, batch.labelNo!);
  // Seed SKUs have dashes of their own, e.g. ACC-SIL-15-1.
  assert.match(code, /-.*-\d+$/);

  const scanned = findScannedStock(s.products, s.batches, ` ${code} `);
  assert.equal(scanned?.product.id, product.id);
  assert.equal(scanned?.batch?.id, batch.id);

  const old = findScannedStock(s.products, s.batches, product.sku);
  assert.equal(old?.product.id, product.id);
  assert.equal(old?.batch, undefined);

  const unknownLot = findScannedStock(
    s.products,
    s.batches,
    lotBarcode(product.sku, 999),
  );
  assert.equal(unknownLot?.product.id, product.id);
  assert.equal(unknownLot?.batch, undefined);

  assert.equal(findProductByScannedSku(s.products, code)?.id, product.id);
  assert.equal(findScannedStock(s.products, s.batches, "NOPE-1"), undefined);
});

test("an exact SKU wins over reading the end as a lot number", () => {
  const s = normalizeWorkspace(createSeed());
  const [first, second] = s.products.filter((p) => !p.serialized);
  second.sku = `${first.sku}-1`;
  const scanned = findScannedStock(s.products, s.batches, second.sku);
  assert.equal(scanned?.product.id, second.id);
  assert.equal(scanned?.batch, undefined);
});

test("a sale names its lot: without one it is refused, with one it costs that lot", () => {
  const s = normalizeWorkspace(createSeed());
  const product = s.products.find((p) => !p.serialized && p.stock > 0)!;
  assert.throws(
    () =>
      run(s, "createSale", {
        customerId: "cust-walkin",
        items: [{ productId: product.id, quantity: 1 }],
        method: "Cash",
      }),
    /Choose the lot for/,
  );
  const batch = s.batches.find(
    (b) => b.productId === product.id && b.remaining > 0,
  )!;
  const scanned = findScannedStock(
    s.products,
    s.batches,
    lotBarcode(product.sku, batch.labelNo!),
  )!;
  const quote = quoteSale(
    s,
    [{ productId: product.id, quantity: 1, batchId: scanned.batch!.id }],
    options,
  );
  assert.equal(quote.lines[0].lot, batch.lot);
  assert.equal(quote.cost, batch.unitCost);
});
