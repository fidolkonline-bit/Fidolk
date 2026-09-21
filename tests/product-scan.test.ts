import assert from "node:assert/strict";
import test from "node:test";
import {
  findProductByScannedSku,
  normalizeScannedSku,
} from "../lib/product-scan";
import type { Product } from "../lib/types";

const products: Product[] = [
  {
    id: "active",
    sku: "FIDO-001",
    name: "USB-C Cable",
    category: "Cables",
    department: "Gifts",
    price: 150000,
    cost: 90000,
    stock: 5,
    reorderLevel: 2,
    serialized: false,
    active: true,
    color: "blue",
  },
  {
    id: "inactive",
    sku: "OLD-001",
    name: "Old Cable",
    category: "Cables",
    department: "Gifts",
    price: 100000,
    cost: 50000,
    stock: 1,
    reorderLevel: 1,
    serialized: false,
    active: false,
    color: "blue",
  },
];

test("normalizes scanner input without changing the stored SKU", () => {
  assert.equal(normalizeScannedSku("  FiDo-001\n"), "fido-001");
});

test("finds an active product by exact case-insensitive SKU", () => {
  assert.equal(findProductByScannedSku(products, " fido-001 ")?.id, "active");
  assert.equal(findProductByScannedSku(products, "FIDO")?.id, undefined);
});

test("does not return inactive products", () => {
  assert.equal(findProductByScannedSku(products, "OLD-001"), undefined);
});
