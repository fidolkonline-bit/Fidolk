import type {
  Batch,
  CartPricingItem,
  PriceSettings,
  PriceTier,
  Product,
  SaleLine,
  Workspace,
} from "./types";

export const PRICE_TIERS: readonly PriceTier[] = [
  "Retail",
  "Wholesale",
  "VIP",
  "Agent",
];
export function priceTierLabel(
  labels: Partial<Record<PriceTier, string>> | undefined,
  tier: PriceTier,
): string {
  return labels?.[tier] || tier;
}
export class PricingError extends Error {}
function fail(message: string): never {
  throw new PricingError(message);
}
function amount(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 1e12
  )
    fail(`${label} must be a nonnegative amount in cents.`);
  return value as number;
}
export function getPricing(product: Product, batch?: Batch): PriceSettings {
  return {
    ...(batch?.pricing ?? product.pricing ?? { Retail: product.price }),
  };
}
export function parsePricing(
  input: unknown,
  defaults?: PriceSettings,
): PriceSettings {
  if (input === undefined) {
    if (!defaults) fail("Retail price is required.");
    input = defaults;
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Enter valid price settings.");
  const raw = input as Record<string, unknown>;
  const result: PriceSettings = { Retail: amount(raw.Retail, "Retail price") };
  for (const key of [
    "Wholesale",
    "VIP",
    "Agent",
    "minimum",
    "maximum",
  ] as const) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "")
      result[key] = amount(raw[key], `${key} price`);
  }
  if (
    result.minimum !== undefined &&
    result.maximum !== undefined &&
    result.minimum > result.maximum
  )
    fail("Minimum selling price cannot exceed maximum selling price.");
  for (const tier of PRICE_TIERS) {
    const value = result[tier];
    if (
      value !== undefined &&
      ((result.minimum !== undefined && value < result.minimum) ||
        (result.maximum !== undefined && value > result.maximum))
    )
      fail(
        `${tier} price must be within the minimum and maximum selling prices.`,
      );
  }
  return result;
}
export interface QuoteOptions {
  customerTier?: PriceTier;
  discount?: number;
  allowTier?: boolean;
  allowDiscount?: boolean;
  allowOverride?: boolean;
  overrideReason?: string;
}
export type QuotedLine = SaleLine & { cartIndex: number; lot: string };
/** Shared preview and authoritative server calculation. Never mutates stock. */
export function quoteSale(
  workspace: Workspace,
  items: readonly CartPricingItem[],
  options: QuoteOptions = {},
) {
  if (!Array.isArray(items) || !items.length || items.length > 100)
    fail("Add between 1 and 100 items to the sale.");
  const available = new Map(workspace.batches.map((b) => [b.id, b.remaining]));
  const usedImeis = new Set<string>();
  const lines: QuotedLine[] = [];
  for (const [cartIndex, item] of (
    items as readonly CartPricingItem[]
  ).entries()) {
    if (!item || typeof item !== "object") fail("Invalid sale item.");
    const product = workspace.products.find((p) => p.id === item.productId);
    if (!product) fail("Product not found.");
    if (product.active === false)
      fail(`${product.name} is inactive and cannot be sold.`);
    const quantity = amount(item.quantity, "Quantity");
    if (!quantity || quantity > 100000)
      fail("Quantity must be between 1 and 100000.");
    const already = lines
      .filter((l) => l.productId === product.id)
      .reduce((n, l) => n + l.quantity, 0);
    if (quantity + already > product.stock)
      fail(`Insufficient stock for ${product.name}.`);
    if (product.serialized && (quantity !== 1 || !item.imei))
      fail("Sell serialized phones individually and choose an IMEI.");
    if (item.imei && (!product.serialized || usedImeis.has(item.imei)))
      fail("Stock batch or IMEI is unavailable.");
    const tier = item.priceTier ?? options.customerTier ?? "Retail";
    if (!PRICE_TIERS.includes(tier)) fail("Choose a valid price tier.");
    if (tier !== "Retail" && !options.allowTier)
      fail("You do not have permission to select price tiers.");
    const discountType = item.discountType ?? "Amount";
    if (discountType !== "Amount" && discountType !== "Percent")
      fail("Choose an amount or percentage discount.");
    const discountValue = item.discountValue ?? 0;
    if (discountType === "Percent") {
      if (
        typeof discountValue !== "number" ||
        !Number.isFinite(discountValue) ||
        discountValue < 0 ||
        discountValue > 100 ||
        Math.abs(discountValue * 100 - Math.round(discountValue * 100)) > 1e-6
      )
        fail(
          "Discount percentage must be between 0 and 100 with at most two decimal places.",
        );
    } else amount(discountValue, "Unit discount");
    if (discountValue > 0 && !options.allowDiscount)
      fail("You do not have permission to apply discounts.");
    if (item.unitPrice !== undefined && !options.allowOverride)
      fail("You do not have permission to override prices.");
    let remaining = quantity;
    const batches = workspace.batches
      .filter(
        (b) => b.productId === product.id && (available.get(b.id) ?? 0) > 0,
      )
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    for (const batch of batches) {
      if (product.serialized && !batch.imeis.includes(item.imei!)) continue;
      const take = Math.min(remaining, available.get(batch.id)!);
      const pricing = getPricing(product, batch);
      const originalPrice = pricing[tier];
      if (originalPrice === undefined)
        fail(
          `${tier} price is not configured for ${product.name}, batch ${batch.lot}.`,
        );
      amount(originalPrice, "Tier price");
      const before =
        item.unitPrice === undefined
          ? originalPrice
          : amount(item.unitPrice, "Manual unit price");
      const unitDiscount =
        discountType === "Amount"
          ? discountValue
          : Number(
              (BigInt(before) * BigInt(Math.round(discountValue * 100)) +
                5000n) /
                10000n,
            );
      if (unitDiscount > before)
        fail("Unit discount cannot exceed the selling price.");
      const price = before - unitDiscount;
      for (const value of [item.overrideReason, options.overrideReason]) {
        if (
          value !== undefined &&
          (typeof value !== "string" || value.length > 1000)
        )
          fail("Override reason must be text of at most 1000 characters.");
      }
      const reason =
        item.overrideReason?.trim() || options.overrideReason?.trim();
      if (
        reason !== undefined &&
        (typeof reason !== "string" || reason.length > 1000)
      )
        fail("Override reason must be text of at most 1000 characters.");
      if (item.unitPrice !== undefined && !reason?.trim())
        fail("Record a reason for the manual price override.");
      lines.push({
        cartIndex,
        productId: product.id,
        name: product.name,
        quantity: take,
        price,
        cost: batch.unitCost,
        imei: item.imei || undefined,
        priceTier: tier,
        originalPrice,
        unitPriceBeforeDiscount: before,
        unitDiscount,
        discountType,
        discountValue,
        minimumPrice: pricing.minimum,
        maximumPrice: pricing.maximum,
        lot: batch.lot,
        overrideReason: reason?.trim() || undefined,
        batchAllocations: [
          { batchId: batch.id, quantity: take, unitCost: batch.unitCost },
        ],
      });
      available.set(batch.id, available.get(batch.id)! - take);
      remaining -= take;
      if (!remaining) break;
    }
    if (remaining) fail("Stock batch or IMEI is unavailable.");
    if (item.imei) usedImeis.add(item.imei);
  }
  const subtotal = amount(
    lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    "Subtotal",
  );
  const discount = amount(options.discount ?? 0, "Invoice discount");
  if (discount && !options.allowDiscount)
    fail("You do not have permission to apply discounts.");
  if (discount > subtotal) fail("Discount cannot exceed the subtotal.");
  // Cumulative allocation keeps every cent accounted for, including the last line.
  let cumulativeGross = 0,
    allocated = 0;
  for (const line of lines) {
    const gross = line.price * line.quantity;
    cumulativeGross += gross;
    const target = Number(
      (BigInt(discount) * BigInt(cumulativeGross)) / BigInt(subtotal || 1),
    );
    line.invoiceDiscount = target - allocated;
    allocated = target;
    line.total = gross - line.invoiceDiscount;
    const belowMin =
      line.minimumPrice !== undefined &&
      line.total < line.minimumPrice * line.quantity;
    const aboveMax =
      line.maximumPrice !== undefined &&
      line.total > line.maximumPrice * line.quantity;
    const belowCost = line.total < line.cost * line.quantity;
    if (belowMin || aboveMax || belowCost) {
      const issue = belowMin
        ? `below the minimum selling price of LKR ${(line.minimumPrice! / 100).toFixed(2)} per unit`
        : aboveMax
          ? `above the maximum selling price of LKR ${(line.maximumPrice! / 100).toFixed(2)} per unit`
          : "below cost";
      if (!options.allowOverride || !line.overrideReason)
        fail(
          `${line.name}, batch ${line.lot}: final price is ${issue}. An authorized price override and reason are required.`,
        );
    }
  }
  const cost = amount(
    lines.reduce((sum, l) => sum + l.cost * l.quantity, 0),
    "Cost",
  );
  return { lines, subtotal, discount, total: subtotal - discount, cost };
}

/** Detect stale stock/prices between the displayed quote and completion. */
export function quoteSignature(quote: ReturnType<typeof quoteSale>): string {
  return JSON.stringify({
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    lines: quote.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      imei: line.imei,
      priceTier: line.priceTier,
      originalPrice: line.originalPrice,
      price: line.price,
      total: line.total,
      batchAllocations: line.batchAllocations,
      minimum: line.minimumPrice,
      maximum: line.maximumPrice,
    })),
  });
}
