import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createSeed } from "../lib/seed";
import { parsePricing, quoteSale } from "../lib/pricing";
import type { AuthUser, Workspace, PriceSettings } from "../lib/types";
const prices: PriceSettings = {
  Retail: 120000,
  Wholesale: 95000,
  VIP: 105000,
  Agent: 100000,
  minimum: 90000,
  maximum: 130000,
};
const owner: AuthUser = {
  id: "owner",
  name: "Owner",
  username: "owner",
  active: true,
  role: "Owner",
  permissions: ["*"],
};
const staff: AuthUser = {
  ...owner,
  id: "staff",
  role: "Staff",
  permissions: ["sales.manage"],
};
function run(
  s: Workspace,
  type: string,
  payload: Record<string, unknown>,
  actor = owner,
) {
  return applyAction(
    s,
    { type, payload, requestId: randomUUID() },
    undefined,
    actor,
  );
}
function fixture() {
  const s = createSeed();
  s.products[1].pricing = { ...prices };
  s.batches[1].pricing = { ...prices };
  s.batches[1].unitCost = 70000;
  s.settings.commissionConfirmed = true;
  s.settings.accessoryPercent = 2;
  return s;
}
const options = { allowTier: true, allowDiscount: true, allowOverride: false };
function balanced(s: Workspace) {
  for (const entry of s.journal)
    assert.equal(
      entry.lines.reduce((n, l) => n + l.debit - l.credit, 0),
      0,
    );
}

test("price settings distinguish blanks from zero and validate every tier against limits", () => {
  assert.deepEqual(parsePricing({ Retail: 120000, VIP: "", minimum: "" }), {
    Retail: 120000,
  });
  assert.equal(parsePricing({ Retail: 0, minimum: 0, maximum: 0 }).maximum, 0);
  assert.throws(() => parsePricing({ ...prices, minimum: 140000 }), /Minimum/);
  assert.throws(() => parsePricing({ ...prices, VIP: 85000 }), /VIP price/);
  assert.throws(() => parsePricing({ ...prices, Agent: -1 }), /nonnegative/);
  assert.throws(() => parsePricing({ ...prices, Wholesale: 1.5 }), /cents/);
});

test("GRN inherits defaults, permits its own price snapshot, and default edits preserve old stock", () => {
  const s = createSeed();
  run(s, "updateProductPricing", { id: "prod-2", pricing: prices });
  assert.deepEqual(s.batches[1].pricing, { Retail: 120000 });
  run(s, "receiveStock", {
    productId: "prod-2",
    supplier: "Supplier",
    lot: "NEW-A",
    quantity: 2,
    unitCost: 70000,
  });
  assert.deepEqual(s.batches.at(-1)!.pricing, prices);
  run(s, "receiveStock", {
    productId: "prod-2",
    supplier: "Supplier",
    lot: "NEW-B",
    quantity: 1,
    unitCost: 70000,
    pricing: { ...prices, Retail: 125000 },
  });
  run(s, "updateProductPricing", {
    id: "prod-2",
    pricing: { ...prices, Retail: 129000 },
  });
  assert.equal(s.batches.at(-1)!.pricing!.Retail, 125000);
  assert.equal(s.batches.at(-2)!.pricing!.Retail, 120000);
  assert.equal(s.products[1].price, 129000);
  balanced(s);
});

test("FIFO quote separates differently priced batches and accounts for repeated cart items", () => {
  const s = fixture();
  s.batches[1].remaining = 1;
  s.products[1].stock = 3;
  s.batches.push({
    ...s.batches[1],
    id: "new",
    lot: "NEW",
    remaining: 2,
    quantity: 2,
    receivedAt: "2099-01-01",
    unitCost: 80000,
    pricing: { ...prices, VIP: 110000 },
  });
  const quote = quoteSale(
    s,
    [
      { productId: "prod-2", quantity: 1, priceTier: "VIP" },
      { productId: "prod-2", quantity: 2, priceTier: "VIP" },
    ],
    options,
  );
  assert.deepEqual(
    quote.lines.map((l) => [l.lot, l.quantity, l.price]),
    [
      [s.batches[1].lot, 1, 105000],
      ["NEW", 2, 110000],
    ],
  );
  assert.equal(quote.total, 325000);
  assert.equal(quote.cost, 230000);
  assert.equal(s.batches[1].remaining, 1, "preview must not consume stock");
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 3, priceTier: "VIP" }],
  });
  assert.equal(s.sales.at(-1)!.lines.length, 2);
  assert.equal(s.products[1].stock, 0);
  balanced(s);
});

test("selected IMEI uses that exact batch price and duplicate IMEI cannot be sold twice", () => {
  const s = createSeed();
  s.batches[0].pricing = { Retail: 19000000 };
  s.batches.push({
    ...s.batches[0],
    id: "phone-new",
    lot: "PHONE-NEW",
    quantity: 1,
    remaining: 1,
    imeis: ["123456789012345"],
    pricing: { Retail: 20000000 },
    receivedAt: "2099-01-01",
  });
  s.products[0].stock++;
  const item = { productId: "prod-1", quantity: 1, imei: "123456789012345" };
  const quote = quoteSale(s, [item], options);
  assert.equal(quote.total, 20000000);
  assert.equal(quote.lines[0].lot, "PHONE-NEW");
  assert.throws(() => quoteSale(s, [item, item], options), /unavailable/);
});

test("tier plus extra discount determines profit commission, and historic sale survives price edits", () => {
  const s = fixture();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [
      {
        productId: "prod-2",
        quantity: 1,
        priceTier: "VIP",
        discountType: "Amount",
        discountValue: 5000,
      },
    ],
  });
  const sale = s.sales.at(-1)!;
  assert.equal(sale.total, 100000);
  assert.equal(sale.cost, 70000);
  assert.equal(sale.commission, 600);
  assert.equal(sale.lines[0].originalPrice, 105000);
  assert.equal(sale.lines[0].unitDiscount, 5000);
  run(s, "updateBatchPricing", {
    id: s.batches[1].id,
    pricing: { ...prices, VIP: 115000 },
  });
  assert.equal(sale.lines[0].originalPrice, 105000);
  assert.equal(sale.total, 100000);
  run(s, "returnItems", {
    saleId: sale.id,
    reason: "Return",
    resolution: "Refund",
    items: [{ lineIndex: 0, quantity: 1, disposition: "Restock" }],
  });
  assert.equal(s.returns.at(-1)!.total, 100000);
  balanced(s);
});

test("percentage discounts use cent rounding and all invoice discounts obey the final minimum", () => {
  const s = fixture();
  const quote = quoteSale(
    s,
    [
      {
        productId: "prod-2",
        quantity: 1,
        priceTier: "VIP",
        discountType: "Percent",
        discountValue: 5,
      },
    ],
    options,
  );
  assert.equal(quote.total, 99750);
  assert.throws(
    () =>
      quoteSale(
        s,
        [
          {
            productId: "prod-2",
            quantity: 1,
            priceTier: "VIP",
            discountValue: 20000,
          },
        ],
        options,
      ),
    /minimum/,
  );
  assert.throws(
    () =>
      quoteSale(s, [{ productId: "prod-2", quantity: 2, priceTier: "VIP" }], {
        ...options,
        discount: 30001,
      }),
    /minimum/,
  );
});

test("server rejects unpermitted tier, discounts and overrides, even with forged line prices", () => {
  const s = fixture();
  const sale = (item: Record<string, unknown>, extra = {}) =>
    run(
      structuredClone(s),
      "createSale",
      {
        customerId: "cust-1",
        items: [{ productId: "prod-2", quantity: 1, ...item }],
        ...extra,
      },
      staff,
    );
  assert.throws(() => sale({ priceTier: "VIP" }), /permission/);
  assert.throws(() => sale({ discountValue: 1 }), /permission/);
  assert.throws(() => sale({}, { discount: 1 }), /permission/);
  assert.throws(
    () => sale({ unitPrice: 95000, overrideReason: "test" }),
    /permission/,
  );
  const forged = structuredClone(s);
  run(
    forged,
    "createSale",
    {
      customerId: "cust-1",
      items: [
        {
          productId: "prod-2",
          quantity: 1,
          price: 1,
          cost: 0,
          minimumPrice: 0,
        },
      ],
    },
    staff,
  );
  assert.equal(forged.sales.at(-1)!.total, 120000);
});

test("authorized overrides require a reason, enforce maximum and below-cost restrictions, and are audited", () => {
  const s = fixture();
  assert.throws(
    () =>
      run(structuredClone(s), "createSale", {
        customerId: "cust-1",
        items: [{ productId: "prod-2", quantity: 1, unitPrice: 140000 }],
      }),
    /reason/,
  );
  assert.throws(
    () =>
      quoteSale(s, [{ productId: "prod-2", quantity: 1 }], {
        ...options,
        discount: 60000,
      }),
    /minimum/,
  );
  const noBounds = fixture();
  noBounds.batches[1].pricing = { Retail: 60000 };
  assert.throws(
    () => quoteSale(noBounds, [{ productId: "prod-2", quantity: 1 }], options),
    /below cost/,
  );
  run(s, "createSale", {
    customerId: "cust-1",
    items: [
      {
        productId: "prod-2",
        quantity: 1,
        unitPrice: 140000,
        overrideReason: "Special agreed service bundle",
      },
    ],
  });
  assert.equal(s.sales.at(-1)!.total, 140000);
  assert.match(s.audit[0].detail, /Special agreed service bundle/);
  const limited = {
    ...staff,
    permissions: [...staff.permissions, "sales.discount" as const],
  };
  assert.throws(
    () =>
      run(
        fixture(),
        "createSale",
        {
          customerId: "cust-1",
          items: [{ productId: "prod-2", quantity: 1 }],
          discount: 60000,
          overrideReason: "Owner said okay",
        },
        limited,
      ),
    /authorized/,
  );
});

test("missing tiers are never zero-priced and customer preferred tiers are applied by server", () => {
  const s = fixture();
  s.batches[1].pricing = { Retail: 120000 };
  assert.throws(
    () =>
      quoteSale(
        s,
        [{ productId: "prod-2", quantity: 1, priceTier: "VIP" }],
        options,
      ),
    /not configured/,
  );
  s.batches[1].pricing = { ...prices };
  s.customers[1].priceTier = "Wholesale";
  run(s, "createSale", {
    customerId: s.customers[1].id,
    items: [{ productId: "prod-2", quantity: 1 }],
  });
  assert.equal(s.sales.at(-1)!.total, 95000);
});

test("partial refunds allocate exact recorded net totals including every invoice-discount cent", () => {
  const s = fixture();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [
      {
        productId: "prod-2",
        quantity: 3,
        priceTier: "VIP",
        discountValue: 100,
      },
    ],
    discount: 2,
  });
  const sale = s.sales.at(-1)!;
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    run(s, "returnItems", {
      saleId: sale.id,
      reason: "Return one",
      resolution: "Refund",
      items: [{ lineIndex: 0, quantity: 1, disposition: "Restock" }],
    });
    sum += s.returns.at(-1)!.total;
  }
  assert.equal(sum, sale.total);
  assert.equal(s.products[1].stock, 24);
  balanced(s);
});

test("new products accept pricing settings without duplicate legacy price and old items remain Retail", () => {
  const s = createSeed();
  run(s, "newProduct", {
    name: "Case",
    sku: "NEW",
    department: "Phones",
    category: "Accessories",
    pricing: prices,
  });
  assert.equal(s.products.at(-1)!.price, 120000);
  assert.equal(
    quoteSale(s, [{ productId: "prod-2", quantity: 1 }], options).total,
    120000,
  );
});

test("purchase-order partial receipts store separate tier and limit snapshots", () => {
  const s = fixture();
  run(s, "addSupplier", { name: "Pricing test supplier" });
  run(s, "createPurchaseOrder", {
    supplierId: s.suppliers[0].id,
    dueDate: "2026-12-01",
    lines: [{ productId: "prod-2", quantity: 3, unitCost: 70000 }],
    discount: 0,
  });
  const order = s.purchaseOrders.at(-1)!;
  run(s, "receivePurchaseOrder", {
    id: order.id,
    lines: [
      {
        lineIndex: 0,
        quantity: 1,
        lot: "PO-A",
        pricing: { ...prices, VIP: 109000 },
      },
    ],
    paid: 0,
  });
  run(s, "receivePurchaseOrder", {
    id: order.id,
    lines: [{ lineIndex: 0, quantity: 2, lot: "PO-B" }],
    paid: 0,
  });
  assert.equal(s.batches.at(-2)!.pricing!.VIP, 109000);
  assert.deepEqual(s.batches.at(-1)!.pricing, prices);
  assert.equal(order.status, "Received");
  balanced(s);
});

test("invoice override reason is used when a line reason was cleared", () => {
  const s = fixture();
  run(s, "createSale", {
    customerId: "cust-1",
    items: [{ productId: "prod-2", quantity: 1, overrideReason: "" }],
    discount: 50000,
    overrideReason: "Owner approved clearance",
  });
  assert.equal(
    s.sales.at(-1)!.lines[0].overrideReason,
    "Owner approved clearance",
  );
});

test("stock or price changes invalidate the submitted checkout quote before stock is consumed", async () => {
  const { quoteSignature } = await import("../lib/pricing");
  const s = fixture();
  const items = [{ productId: "prod-2", quantity: 1 }];
  const signature = quoteSignature(quoteSale(s, items, options));
  s.batches[1].pricing!.Retail = 121000;
  assert.throws(
    () =>
      run(s, "createSale", {
        customerId: "cust-1",
        items,
        quoteSignature: signature,
      }),
    /Stock or prices changed/,
  );
  assert.equal(s.products[1].stock, 24);
});
