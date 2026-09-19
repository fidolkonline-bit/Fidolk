import { canAcknowledgeAlert } from "./alerts";
import { randomUUID } from "node:crypto";
import type {
  Workspace,
  Action,
  JournalLine,
  Department,
  RepairStatus,
  PaymentMethod,
  SaleLine,
  AuthUser,
  CartPricingItem,
  PriceSettings,
} from "./types";
import {
  getPricing,
  parsePricing as validatePricing,
  quoteSale as calculateSale,
  PricingError,
  PRICE_TIERS,
  quoteSignature,
} from "./pricing";
import { encryptSecret } from "./secrets";
export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}
const fail = (message: string): never => {
  throw new BusinessError(message);
};
function pricingCall<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof PricingError) return fail(error.message);
    throw error;
  }
}
const parsePricing = (input: unknown, defaults?: PriceSettings) =>
  pricingCall(() => validatePricing(input, defaults));
function snapshotLegacyPrices(s: Workspace) {
  for (const batch of s.batches) {
    if (!batch.pricing) {
      const product = s.products.find((p) => p.id === batch.productId);
      if (product) batch.pricing = getPricing(product);
    }
  }
}
const str = (v: unknown, label: string, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    fail(`${label} is required (maximum ${max} characters).`);
  return (v as string).trim();
};
const optional = (v: unknown, max = 1000) =>
  v === undefined || v === null
    ? ""
    : typeof v === "string" && v.length <= max
      ? v.trim()
      : fail("Invalid text value.");
const money = (v: unknown, label = "Amount") => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0 || v > 1e12)
    fail(`${label} must be a nonnegative amount in cents.`);
  return v as number;
};
const positive = (v: unknown, label = "Amount") => {
  const n = money(v, label);
  if (!n) fail(`${label} must be greater than zero.`);
  return n;
};
const qty = (v: unknown) => {
  const n = positive(v, "Quantity");
  if (n > 100000) fail("Quantity is too large.");
  return n;
};
const percent = (v: unknown) => {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < 0 ||
    v > 100 ||
    Math.abs(Math.round(v * 100) - v * 100) > 0.000001
  )
    fail(
      "Percentage must be between 0 and 100 with at most two decimal places.",
    );
  return v as number;
};
const choice = <T extends string>(v: unknown, values: readonly T[]): T =>
  values.includes(v as T)
    ? (v as T)
    : fail(`Choose one of: ${values.join(", ")}.`);
const department = (v: unknown) =>
  choice(v, ["Phones", "Clothing", "Gifts"] as const);
const payment = (v: unknown) =>
  choice(v, ["Cash", "Card", "Bank transfer", "Credit"] as const);
const account = (method: PaymentMethod) =>
  method === "Cash"
    ? "Cash"
    : method === "Credit"
      ? "Accounts receivable"
      : "Bank";
const rate = (amount: number, p: number) =>
  Number((BigInt(amount) * BigInt(Math.round(p * 100)) + 5000n) / 10000n);
const date = (v: unknown) => {
  const s = str(v, "Date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)))
    fail("Enter a valid date.");
  return s;
};
const phone = (v: unknown) => {
  const s = optional(v, 30).replace(/[\s-]+/g, "");
  if (s && !/^(?:0\d{9}|\+?94\d{9})$/.test(s))
    fail("Enter a valid Sri Lankan phone number.");
  return s;
};
const nextNumber = (prefix: string, items: { number: string }[]) =>
  `${prefix}-${String(Math.max(0, ...items.map((x) => Number(x.number.split("-").pop()) || 0)) + 1).padStart(5, "0")}`;
const find = <T extends { id: string }>(
  items: T[],
  id: unknown,
  label: string,
): T => items.find((x) => x.id === id) ?? fail(`${label} not found.`);
function journal(
  s: Workspace,
  reference: string,
  description: string,
  lines: JournalLine[],
  now: string,
) {
  lines = lines.filter((l) => l.credit || l.debit);
  if (
    lines.some(
      (l) =>
        !Number.isSafeInteger(l.debit) ||
        !Number.isSafeInteger(l.credit) ||
        l.debit < 0 ||
        l.credit < 0,
    ) ||
    lines.reduce((sum, l) => sum + l.debit - l.credit, 0) !== 0
  )
    fail("Accounting entry does not balance.");
  s.journal.push({
    id: randomUUID(),
    reference,
    description,
    date: now,
    lines,
  });
}
const dr = (account: string, debit: number): JournalLine => ({
  account,
  debit,
  credit: 0,
});
const cr = (account: string, credit: number): JournalLine => ({
  account,
  debit: 0,
  credit,
});
function sms(s: Workspace, number: string, message: string, now: string) {
  if (number)
    s.sms.push({
      id: randomUUID(),
      phone: number,
      message,
      status:
        s.settings.smsEnabled && s.settings.smsApiKeyConfigured
          ? "Queued"
          : "Pending configuration",
      createdAt: now,
    });
}
function consume(
  s: Workspace,
  productId: string,
  quantity: number,
  imei?: string,
) {
  const p = find(s.products, productId, "Product");
  if (quantity > p.stock) fail(`Insufficient stock for ${p.name}.`);
  if (p.serialized && (quantity !== 1 || !imei))
    fail("Sell serialized phones individually and choose an IMEI.");
  const batches = s.batches
    .filter((b) => b.productId === p.id && b.remaining > 0)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  let left = quantity;
  const allocations: SaleLine["batchAllocations"] = [];
  for (const b of batches) {
    if (p.serialized && !b.imeis.includes(imei!)) continue;
    const take = Math.min(left, b.remaining);
    b.remaining -= take;
    if (p.serialized) b.imeis = b.imeis.filter((x) => x !== imei);
    allocations.push({ batchId: b.id, quantity: take, unitCost: b.unitCost });
    left -= take;
    if (!left) break;
  }
  if (left) fail("Stock batch or IMEI is unavailable.");
  p.stock -= quantity;
  return {
    allocations,
    cost: allocations.reduce((n, a) => n + a.quantity * a.unitCost, 0),
  };
}
export function applyAction(
  s: Workspace,
  action: Action,
  now = new Date().toISOString(),
  actor?: AuthUser,
): Workspace {
  const p = action.payload;
  let detail = action.type;
  switch (action.type) {
    case "createSale": {
      const c = find(s.customers, p.customerId, "Customer");
      if (!Array.isArray(p.items) || !p.items.length || p.items.length > 100)
        fail("Add at least one item to the sale.");
      const allowed = (
        permission:
          "sales.priceTier" | "sales.discount" | "sales.priceOverride",
      ) =>
        !actor ||
        actor.permissions.includes("*") ||
        actor.permissions.includes(permission);
      const quote = pricingCall(() =>
        calculateSale(s, p.items as CartPricingItem[], {
          customerTier: c.priceTier,
          discount: p.discount as number | undefined,
          allowTier: allowed("sales.priceTier"),
          allowDiscount: allowed("sales.discount"),
          allowOverride: allowed("sales.priceOverride"),
          overrideReason: p.overrideReason as string | undefined,
        }),
      );
      if (
        p.quoteSignature !== undefined &&
        p.quoteSignature !== quoteSignature(quote)
      )
        fail(
          "Stock or prices changed since this quote. Refresh the workspace and review the sale before completing it.",
        );
      const { subtotal, discount, total, cost } = quote;
      const lines: SaleLine[] = quote.lines.map(
        ({ cartIndex: _cartIndex, ...line }) => line,
      );
      const paid = money(p.paid ?? total, "Payment");
      if (paid > total)
        fail(
          "Payment cannot exceed the invoice total; enter the amount retained after change.",
        );
      const method = payment(p.method ?? "Cash");
      if (method === "Credit" && paid > 0)
        fail("Choose the actual payment method for a partial payment.");
      if (paid < total && c.id === "cust-walkin")
        fail("Select a named customer for credit or partial payment.");
      let commission = 0,
        agentCommission = 0;
      const agent = p.agentId ? find(s.agents, p.agentId, "Agent") : undefined;
      const salesperson =
        s.staff.find((member) => member.id === (p.staffId ?? actor?.staffId)) ??
        s.staff[0];
      if (agent && !agent.active) fail("This agent is inactive.");
      if (s.settings.commissionConfirmed) {
        let pool = 0;
        lines.forEach((l) => {
          const lineTotal = l.price * l.quantity;
          const lineDiscount = l.invoiceDiscount ?? 0;
          const product = find(s.products, l.productId, "Product");
          if (
            product.category === "Accessories" ||
            product.category === "Audio"
          ) {
            const lineCost = l.batchAllocations.reduce(
              (a, b) => a + b.quantity * b.unitCost,
              0,
            );
            pool += rate(
              Math.max(0, lineTotal - lineDiscount - lineCost),
              s.settings.accessoryPercent,
            );
          }
        });
        agentCommission = agent
          ? rate(
              pool,
              agent.defaultSharePercent ?? s.settings.agentSharePercent,
            )
          : p.agent === true
            ? rate(pool, s.settings.agentSharePercent)
            : 0;
        commission = pool - agentCommission;
      }
      const number = nextNumber("INV", s.sales);
      const deps = new Set(
        lines.map((l) => find(s.products, l.productId, "Product").department),
      );
      const sale = {
        id: randomUUID(),
        number,
        customerId: c.id,
        customerName: c.name,
        department: deps.size === 1 ? [...deps][0] : ("Mixed" as const),
        lines,
        subtotal,
        discount,
        total,
        cost,
        paid,
        method,
        status:
          paid === total
            ? ("Paid" as const)
            : paid
              ? ("Partial" as const)
              : ("Credit" as const),
        createdAt: now,
        commission,
        agentCommission,
        agentId: agent?.id,
        agentName: agent?.name,
        staffId: salesperson?.id,
        staffName: salesperson?.name,
        dueDate:
          paid < total
            ? date(
                p.dueDate ??
                  new Date(new Date(now).getTime() + 30 * 86400000)
                    .toISOString()
                    .slice(0, 10),
              )
            : undefined,
        creditReminderDaysSent: [],
        payments: paid ? [{ amount: paid, method }] : [],
      };
      for (const line of lines) {
        for (const allocation of line.batchAllocations) {
          const batch = find(s.batches, allocation.batchId, "Batch");
          batch.remaining -= allocation.quantity;
          if (line.imei)
            batch.imeis = batch.imeis.filter((imei) => imei !== line.imei);
        }
        find(s.products, line.productId, "Product").stock -= line.quantity;
      }
      s.sales.push(sale);
      journal(
        s,
        number,
        "Sale completed",
        [
          dr(account(method), paid),
          dr("Accounts receivable", total - paid),
          cr("Sales revenue", total),
          dr("Cost of goods sold", cost),
          cr("Inventory", cost),
          dr("Staff commission expense", commission),
          cr("Staff commission payable", commission),
          dr("Agent commission expense", agentCommission),
          cr("Agent commission payable", agentCommission),
        ],
        now,
      );
      sms(
        s,
        c.phone,
        `Fido LK: Invoice ${number}, total LKR ${(total / 100).toFixed(2)}. Paid LKR ${(paid / 100).toFixed(2)}. Thank you.`,
        now,
      );
      detail =
        number +
        lines
          .filter((l) => l.overrideReason)
          .map(
            (l) => `; ${l.name} [${l.lot}] price override: ${l.overrideReason}`,
          )
          .join("");
      break;
    }
    case "returnSale": {
      const sale = find(s.sales, p.saleId, "Invoice");
      if (sale.status === "Returned")
        fail("This invoice has already been returned.");
      if (
        s.shipments.some(
          (sh) =>
            sh.orderRef === sale.number &&
            ["Packed", "Shipped", "Delivered", "Collected"].includes(sh.status),
        )
      )
        fail("Reconcile the COD shipment before returning this invoice.");
      const disposition = choice(p.disposition, [
        "Restock",
        "Supplier return",
        "Waste",
      ] as const);
      const reason = str(p.reason, "Return reason", 1000);
      if (disposition === "Restock") {
        for (const line of sale.lines) {
          const product = find(s.products, line.productId, "Product");
          product.stock += line.quantity;
          for (const allocation of line.batchAllocations) {
            const batch = find(s.batches, allocation.batchId, "Batch");
            batch.remaining += allocation.quantity;
            if (line.imei) batch.imeis.push(line.imei);
          }
        }
      }
      const refund = sale.paid;
      const inventoryAccount =
        disposition === "Restock"
          ? "Inventory"
          : disposition === "Supplier return"
            ? "Stock pending supplier return"
            : "Stock loss expense";
      journal(
        s,
        sale.number,
        "Full invoice return: " + reason,
        [
          dr("Sales revenue", sale.total),
          ...(
            sale.payments ?? [
              {
                amount: refund,
                method: sale.method === "Credit" ? "Cash" : sale.method,
              },
            ]
          ).map((receipt) => cr(account(receipt.method), receipt.amount)),
          cr("Accounts receivable", sale.total - refund),
          dr(inventoryAccount, sale.cost),
          cr("Cost of goods sold", sale.cost),
          dr("Staff commission payable", sale.commission),
          cr("Staff commission expense", sale.commission),
          dr("Agent commission payable", sale.agentCommission),
          cr("Agent commission expense", sale.agentCommission),
        ],
        now,
      );
      sale.status = "Returned";
      sale.commission = 0;
      sale.agentCommission = 0;
      sale.returnInfo = { reason, disposition, refund, at: now };
      break;
    }
    case "returnItems": {
      const sale = find(s.sales, p.saleId, "Invoice");
      if (!Array.isArray(p.items) || !p.items.length)
        fail("Select at least one item to return.");
      const resolution = choice(p.resolution, [
        "Refund",
        "Exchange",
        "Store credit",
      ] as const);
      const reason = str(p.reason, "Return reason", 1000);
      const previous = s.returns.filter((item) => item.saleId === sale.id);
      if (
        new Set(
          (p.items as Record<string, unknown>[]).map((item) => item.lineIndex),
        ).size !== (p.items as unknown[]).length
      )
        fail("Select each invoice line only once per return.");
      const items = (p.items as Record<string, unknown>[]).map((raw) => {
        const lineIndex = money(raw.lineIndex, "Invoice line");
        const line = sale.lines[lineIndex];
        if (!line) fail("Invoice line not found.");
        const quantity = qty(raw.quantity);
        const already = previous
          .flatMap((item) => item.items)
          .filter((item) => item.lineIndex === lineIndex)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (quantity > line.quantity - already)
          fail(
            `Return quantity exceeds the remaining quantity for ${line.name}.`,
          );
        if (line.imei && (quantity !== 1 || already))
          fail("A serialized item can only be returned once.");
        const disposition = choice(raw.disposition, [
          "Restock",
          "Supplier return",
          "Waste",
        ] as const);
        const gross = line.price * quantity;
        const refundAmount =
          line.total !== undefined
            ? Number(
                (BigInt(line.total) * BigInt(already + quantity)) /
                  BigInt(line.quantity),
              ) -
              Number(
                (BigInt(line.total) * BigInt(already)) / BigInt(line.quantity),
              )
            : gross -
              Number(
                (BigInt(sale.discount) * BigInt(gross)) /
                  BigInt(sale.subtotal || 1),
              );
        let left = quantity;
        let cost = 0;
        for (const allocation of line.batchAllocations) {
          const used = Math.min(left, allocation.quantity);
          cost += used * allocation.unitCost;
          if (disposition === "Restock" && used) {
            const batch = find(s.batches, allocation.batchId, "Batch");
            batch.remaining += used;
            if (line.imei && !batch.imeis.includes(line.imei))
              batch.imeis.push(line.imei);
          }
          left -= used;
          if (!left) break;
        }
        if (disposition === "Restock")
          find(s.products, line.productId, "Product").stock += quantity;
        return {
          lineIndex,
          quantity,
          disposition,
          amount: refundAmount,
          cost,
        };
      });
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      const cost = items.reduce((sum, item) => sum + item.cost, 0);
      const previouslyReturned = previous.reduce(
        (sum, item) => sum + item.total,
        0,
      );
      const paidPortion = Math.min(
        total,
        Math.max(0, sale.paid - previouslyReturned),
      );
      const receivablePortion = total - paidPortion;
      const staffReverse = Math.min(
        sale.commission,
        rate(sale.commission, (total / Math.max(1, sale.total)) * 100),
      );
      const agentReverse = Math.min(
        sale.agentCommission,
        rate(sale.agentCommission, (total / Math.max(1, sale.total)) * 100),
      );
      const inventoryLines = items.flatMap((item) => [
        dr(
          item.disposition === "Restock"
            ? "Inventory"
            : item.disposition === "Supplier return"
              ? "Stock pending supplier return"
              : "Stock loss expense",
          item.cost,
        ),
      ]);
      journal(
        s,
        sale.number,
        `Item return: ${reason}`,
        [
          dr("Sales returns", total),
          cr(
            resolution === "Refund" ? "Cash" : "Store credit liability",
            paidPortion,
          ),
          cr("Accounts receivable", receivablePortion),
          ...inventoryLines,
          cr("Cost of goods sold", cost),
          dr("Staff commission payable", staffReverse),
          cr("Staff commission expense", staffReverse),
          dr("Agent commission payable", agentReverse),
          cr("Agent commission expense", agentReverse),
        ],
        now,
      );
      sale.commission -= staffReverse;
      sale.agentCommission -= agentReverse;
      if (resolution !== "Refund") {
        const customer = find(s.customers, sale.customerId, "Customer");
        customer.storeCredit = (customer.storeCredit ?? 0) + paidPortion;
      }
      const record = {
        id: randomUUID(),
        saleId: sale.id,
        saleNumber: sale.number,
        items,
        resolution,
        reason,
        total,
        cost,
        createdAt: now,
      };
      s.returns.push(record);
      const allReturned = sale.lines.every(
        (line, index) =>
          previous
            .flatMap((item) => item.items)
            .filter((item) => item.lineIndex === index)
            .reduce((sum, item) => sum + item.quantity, 0) +
            items
              .filter((item) => item.lineIndex === index)
              .reduce((sum, item) => sum + item.quantity, 0) >=
          line.quantity,
      );
      if (allReturned) sale.status = "Returned";
      detail = sale.number;
      break;
    }
    case "editStaff": {
      const staff = find(s.staff, p.id, "Staff");
      staff.name = str(p.name, "Staff name");
      staff.salary = money(p.salary, "Basic salary");
      break;
    }
    case "updateProductPricing": {
      const product = find(s.products, p.id, "Product");
      const pricing = parsePricing(p.pricing);
      snapshotLegacyPrices(s);
      product.pricing = pricing;
      product.price = pricing.Retail;
      detail = `${product.sku}: product price defaults updated`;
      break;
    }
    case "updateBatchPricing": {
      const batch = find(s.batches, p.id, "Batch");
      batch.pricing = parsePricing(p.pricing);
      detail = `${batch.lot}: batch selling prices updated`;
      break;
    }
    case "newProduct": {
      const sku = str(p.sku, "SKU", 80);
      if (s.products.some((x) => x.sku.toLowerCase() === sku.toLowerCase()))
        fail("This SKU already exists.");
      const pricing = parsePricing(p.pricing, {
        Retail: money(
          p.price ?? (p.pricing as PriceSettings | undefined)?.Retail,
          "Retail price",
        ),
      });
      s.products.push({
        pricing,
        id: randomUUID(),
        sku,
        name: str(p.name, "Product name"),
        department: department(p.department),
        category: str(p.category, "Category"),
        price: pricing.Retail,
        cost: money(p.cost ?? 0, "Cost"),
        stock: 0,
        reorderLevel: money(p.reorderLevel ?? 5, "Reorder level"),
        serialized: p.serialized === true,
        active: p.active !== false,
        color: "blue",
      });
      break;
    }
    case "setProductActive": {
      const product = find(s.products, p.id, "Product");
      product.active = p.active === true;
      detail = `${product.sku}: ${product.active ? "activated" : "deactivated"}`;
      break;
    }
    case "receiveStock": {
      const product = find(s.products, p.productId, "Product");
      const pricing = parsePricing(p.pricing, getPricing(product));
      const quantity = qty(p.quantity);
      const unitCost = money(p.unitCost, "Unit cost");
      const total = quantity * unitCost;
      money(total);
      const paid = money(p.paid ?? 0, "Amount paid");
      if (paid > total) fail("Payment exceeds the purchase total.");
      const supplier = str(p.supplier, "Supplier");
      const lot = str(p.lot, "Lot number", 80);
      if (s.batches.some((b) => b.lot === lot && b.productId === product.id))
        fail("This product already has that lot number.");
      const imeis = Array.isArray(p.imeis)
        ? p.imeis.map((v) => str(v, "IMEI", 30))
        : [];
      if (
        product.serialized &&
        (imeis.length !== quantity ||
          new Set(imeis).size !== quantity ||
          imeis.some((i) => !/^\d{15}$/.test(i)))
      )
        fail("Provide one unique 15-digit IMEI per phone.");
      const existing = new Set([
        ...s.batches.flatMap((b) => b.imeis),
        ...s.sales.flatMap((x) => x.lines.map((l) => l.imei).filter(Boolean)),
      ]);
      if (imeis.some((i) => existing.has(i)))
        fail("An IMEI is already recorded.");
      s.batches.push({
        id: randomUUID(),
        productId: product.id,
        lot,
        supplier,
        pricing,
        quantity,
        remaining: quantity,
        unitCost,
        receivedAt: now,
        imeis,
      });
      product.stock += quantity;
      product.cost = unitCost;
      const number = nextNumber("GRN", s.purchases);
      s.purchases.push({
        id: randomUUID(),
        number,
        supplier,
        total,
        paid,
        date: now,
        status: "Received",
      });
      journal(
        s,
        number,
        "Goods received",
        [
          dr("Inventory", total),
          cr("Cash", paid),
          cr("Accounts payable", total - paid),
        ],
        now,
      );
      detail = number;
      break;
    }
    case "createCustomer": {
      const name = str(p.name, "Customer name");
      const number = phone(p.phone);
      if (!number) fail("A phone number is required.");
      const priceTier = choice(p.priceTier ?? "Retail", PRICE_TIERS);
      s.customers.push({ id: randomUUID(), name, phone: number, priceTier });
      break;
    }
    case "collectPayment": {
      const sale = find(s.sales, p.saleId, "Invoice");
      if (
        s.shipments.some(
          (sh) =>
            sh.orderRef === sale.number &&
            ["Packed", "Shipped", "Delivered"].includes(sh.status),
        )
      )
        fail(
          "This invoice has an active COD shipment; collect through the shipment record.",
        );
      if (sale.status === "Returned")
        fail("A returned invoice cannot receive payments.");
      const amount = positive(p.amount);
      const method = payment(p.method ?? "Cash");
      if (method === "Credit") fail("Choose a payment method.");
      if (amount > sale.total - sale.paid)
        fail("Payment exceeds the outstanding balance.");
      sale.payments ??= sale.paid
        ? [
            {
              amount: sale.paid,
              method: sale.method === "Credit" ? "Cash" : sale.method,
            },
          ]
        : [];
      sale.payments.push({ amount, method });
      sale.paid += amount;
      sale.status = sale.paid === sale.total ? "Paid" : "Partial";
      journal(
        s,
        sale.number,
        "Customer payment",
        [dr(account(method), amount), cr("Accounts receivable", amount)],
        now,
      );
      break;
    }
    case "createRepair": {
      const customerName = str(p.customerName, "Customer name");
      const number = phone(p.phone);
      if (!number) fail("Customer phone is required.");
      const rawParts = Array.isArray(p.parts)
        ? (p.parts as Record<string, unknown>[])
        : p.partProductId
          ? [{ productId: p.partProductId, quantity: 1 }]
          : [];
      const parts = rawParts.map((raw) => {
        const product = find(s.products, raw.productId, "Spare part");
        const quantity = qty(raw.quantity ?? 1);
        if (quantity > product.stock)
          fail(`Insufficient stock for ${product.name}.`);
        return {
          productId: product.id,
          name: product.name,
          quantity,
          estimatedUnitCost: product.cost,
        };
      });
      const partsCost = parts.reduce(
        (sum, part) => sum + part.quantity * part.estimatedUnitCost,
        0,
      );
      const credential = optional(p.deviceAccessSecret, 300);
      const repair = {
        id: randomUUID(),
        number: nextNumber("REP", s.repairs),
        customerName,
        phone: number,
        device: str(p.device, "Device"),
        imei: optional(p.imei, 30),
        issue: str(p.issue, "Reported issue", 1000),
        condition: optional(p.condition),
        accessories: Array.isArray(p.accessories)
          ? p.accessories.map((a) => str(a, "Accessory", 100))
          : [],
        notes: optional(p.notes, 2000),
        estimate: positive(p.estimate, "Estimate"),
        partsCost,
        parts,
        hasCredential: Boolean(credential),
        credentialCiphertext: credential
          ? encryptSecret(credential)
          : undefined,
        staffPercent: percent(p.staffPercent ?? s.settings.repairStaffPercent),
        status: "Received" as const,
        warrantyDays: money(p.warrantyDays ?? 0, "Warranty days"),
        createdAt: now,
        commission: 0,
        paid: 0,
        technicianStaffId:
          s.staff.find(
            (member) => member.id === (p.technicianStaffId ?? actor?.staffId),
          )?.id ?? s.staff[0]?.id,
        technicianName:
          s.staff.find(
            (member) => member.id === (p.technicianStaffId ?? actor?.staffId),
          )?.name ?? s.staff[0]?.name,
      };
      s.repairs.push(repair);
      sms(
        s,
        number,
        `Fido LK: Your ${repair.device} has been received. Job ${repair.number}. We will confirm an estimate before starting work.`,
        now,
      );
      detail = repair.number;
      break;
    }
    case "repairStatus": {
      const r = find(s.repairs, p.id, "Repair");
      const status = choice(p.status, [
        "Received",
        "Diagnosing",
        "Awaiting approval",
        "Approved",
        "In progress",
        "Ready for collection",
        "Collected",
        "Declined",
      ] as const);
      const transitions: Record<RepairStatus, RepairStatus[]> = {
        Received: ["Diagnosing"],
        Diagnosing: ["Awaiting approval"],
        "Awaiting approval": ["Approved", "Declined"],
        Approved: ["In progress"],
        "In progress": ["Ready for collection"],
        "Ready for collection": ["Collected"],
        Collected: [],
        Declined: [],
      };
      if (!transitions[r.status].includes(status))
        fail(`Cannot move from ${r.status} to ${status}.`);
      if (status === "Approved")
        r.approval = {
          method: str(p.approvalMethod, "Approval method"),
          at: now,
        };
      if (status === "Ready for collection") {
        if (!r.approval) fail("Customer approval is required.");
        let partsCost = 0;
        for (const part of r.parts ?? []) {
          const used = consume(s, part.productId, part.quantity);
          part.actualCost = used.cost;
          partsCost += used.cost;
        }
        r.partsCost = partsCost;
        r.commission = rate(
          Math.max(0, r.estimate - partsCost),
          r.staffPercent,
        );
        r.completedAt = now;
        journal(
          s,
          r.number,
          "Repair completed",
          [
            dr("Accounts receivable", r.estimate),
            cr("Repair revenue", r.estimate),
            dr("Repair parts expense", partsCost),
            cr("Inventory", partsCost),
            dr("Staff commission expense", r.commission),
            cr("Staff commission payable", r.commission),
          ],
          now,
        );
        sms(
          s,
          r.phone,
          `Fido LK: ${r.number} is ready for collection. Total LKR ${(r.estimate / 100).toFixed(2)}.`,
          now,
        );
      }
      if (status === "Awaiting approval")
        sms(
          s,
          r.phone,
          `Fido LK: Estimate for ${r.number}: LKR ${(r.estimate / 100).toFixed(2)}. Please contact the shop to approve before work begins.`,
          now,
        );
      if (status === "Collected") {
        delete r.credentialCiphertext;
        r.hasCredential = false;
        sms(
          s,
          r.phone,
          `Fido LK: Thank you for collecting ${r.number}. Outstanding LKR ${((r.estimate - r.paid) / 100).toFixed(2)}.`,
          now,
        );
      }
      r.status = status;
      break;
    }
    case "repairPayment": {
      const r = find(s.repairs, p.id ?? p.repairId, "Repair");
      if (!r.completedAt) fail("Record payment after repair completion.");
      const amount = positive(p.amount);
      if (amount > r.estimate - r.paid)
        fail("Payment exceeds the repair balance.");
      r.paid += amount;
      journal(
        s,
        r.number,
        "Repair payment",
        [dr("Cash", amount), cr("Accounts receivable", amount)],
        now,
      );
      break;
    }
    case "updateRepairEstimate": {
      const r = find(s.repairs, p.id, "Repair");
      if (!["Received", "Diagnosing", "Awaiting approval"].includes(r.status))
        fail("This estimate can no longer be changed.");
      const rawParts = Array.isArray(p.parts)
        ? (p.parts as Record<string, unknown>[])
        : [];
      r.parts = rawParts.map((raw) => {
        const product = find(s.products, raw.productId, "Spare part");
        const quantity = qty(raw.quantity ?? 1);
        if (quantity > product.stock)
          fail(`Insufficient stock for ${product.name}.`);
        return {
          productId: product.id,
          name: product.name,
          quantity,
          estimatedUnitCost: product.cost,
        };
      });
      r.partsCost = r.parts.reduce(
        (sum, item) => sum + item.quantity * item.estimatedUnitCost,
        0,
      );
      r.estimate = positive(p.estimate, "Estimate");
      r.staffPercent = percent(p.staffPercent ?? r.staffPercent);
      r.warrantyDays = money(p.warrantyDays ?? r.warrantyDays, "Warranty days");
      r.approval = undefined;
      r.status = "Awaiting approval";
      sms(
        s,
        r.phone,
        `Fido LK: Estimate for ${r.number}: LKR ${(r.estimate / 100).toFixed(2)}. Please contact the shop to approve before work begins.`,
        now,
      );
      detail = r.number;
      break;
    }
    case "createWarrantyClaim": {
      const r = find(s.repairs, p.id, "Repair");
      if (r.status !== "Collected" || !r.completedAt || !r.warrantyDays)
        fail("This repair has no active warranty.");
      const expires = new Date(r.completedAt!);
      expires.setUTCDate(expires.getUTCDate() + r.warrantyDays);
      if (new Date(now) > expires) fail("The repair warranty has expired.");
      r.warrantyClaims ??= [];
      r.warrantyClaims.push({
        id: randomUUID(),
        issue: str(p.issue, "Warranty issue", 1000),
        createdAt: now,
        status: "Open",
      });
      detail = r.number;
      break;
    }
    case "addExpense": {
      const amount = positive(p.amount);
      const description = str(p.description, "Description");
      const category = str(p.category, "Category");
      const dep =
        p.department === "General" ? "General" : department(p.department);
      const expense = {
        id: randomUUID(),
        description,
        category,
        department: dep as Department | "General",
        amount,
        date: date(p.date ?? now.slice(0, 10)),
      };
      s.expenses.push(expense);
      journal(
        s,
        expense.id,
        description,
        [dr("Operating expenses", amount), cr("Cash", amount)],
        expense.date,
      );
      break;
    }
    case "addCheque": {
      const number = str(p.number, "Cheque number", 80);
      if (s.cheques.some((c) => c.number === number))
        fail("Cheque number already exists.");
      const amount = positive(p.amount);
      const supplier = str(p.supplier, "Supplier");
      const purchaseId = optional(p.purchaseId, 100);
      if (purchaseId) {
        const purchase = find(s.purchases, purchaseId, "Purchase");
        if (purchase.supplier !== supplier)
          fail("Cheque supplier does not match the purchase.");
        const reserved = s.cheques
          .filter(
            (c) =>
              c.purchaseId === purchase.id &&
              ["Issued", "Presented"].includes(c.status),
          )
          .reduce((a, c) => a + c.amount, 0);
        if (amount > purchase.total - purchase.paid - reserved)
          fail("Cheque exceeds the unallocated supplier balance.");
      }
      s.cheques.push({
        id: randomUUID(),
        number,
        supplier,
        amount,
        dueDate: date(p.dueDate),
        status: "Issued",
        purchaseId: purchaseId || undefined,
      });
      break;
    }
    case "chequeStatus": {
      const c = find(s.cheques, p.id, "Cheque");
      const status = choice(p.status, [
        "Issued",
        "Presented",
        "Cleared",
        "Dishonoured",
        "Cancelled",
      ] as const);
      if (
        !["Issued", "Presented"].includes(c.status) ||
        status === "Issued" ||
        status === c.status
      )
        fail("This cheque status transition is not allowed.");
      if (status === "Cleared") {
        if (c.purchaseId) {
          const purchase = find(s.purchases, c.purchaseId, "Purchase");
          if (c.amount > purchase.total - purchase.paid)
            fail("Cheque exceeds the remaining purchase balance.");
          purchase.paid += c.amount;
        }
        journal(
          s,
          c.number,
          "Cheque cleared",
          [
            dr(
              c.purchaseId ? "Accounts payable" : "Supplier advances",
              c.amount,
            ),
            cr("Bank", c.amount),
          ],
          now,
        );
      }
      c.status = status;
      break;
    }
    case "addShipment": {
      const orderRef = str(p.orderRef, "Order reference");
      if (s.shipments.some((x) => x.orderRef === orderRef))
        fail("A shipment already exists for this order.");
      const sale =
        s.sales.find((x) => x.number === orderRef) ??
        fail("Use an existing unpaid invoice number as the order reference.");
      const amount = positive(p.amount, "COD amount");
      if (amount !== sale.total - sale.paid)
        fail("COD amount must equal the invoice outstanding balance.");
      const postage = money(p.postage ?? 0, "Postage");
      const shipment = {
        id: randomUUID(),
        orderRef,
        customerName: str(p.customerName, "Customer"),
        tracking: optional(p.tracking, 100),
        amount,
        postage,
        status: "Packed" as const,
        date: now,
        collected: 0,
        courier: optional(p.courier, 80) || "SL Post",
      };
      s.shipments.push(shipment);
      if (postage)
        journal(
          s,
          orderRef,
          "Postage paid separately",
          [dr("Courier expense", postage), cr("Cash", postage)],
          now,
        );
      break;
    }
    case "shipmentStatus": {
      const sh = find(s.shipments, p.id, "Shipment");
      const status = choice(p.status, [
        "Packed",
        "Shipped",
        "Delivered",
        "Collected",
        "Returned",
      ] as const);
      const allowed: Record<string, string[]> = {
        Packed: ["Shipped"],
        Shipped: ["Delivered", "Returned"],
        Delivered: ["Collected"],
        Collected: [],
        Returned: [],
      };
      if (!allowed[sh.status].includes(status))
        fail("Invalid shipment status transition.");
      if (status === "Delivered")
        journal(
          s,
          sh.orderRef,
          "COD delivered; awaiting remittance",
          [
            dr("Courier receivable", sh.amount),
            cr("Accounts receivable", sh.amount),
          ],
          now,
        );
      if (status === "Collected") {
        const sale = s.sales.find((x) => x.number === sh.orderRef)!;
        if (sale.paid !== sale.total - sh.amount)
          fail("Invoice balance changed; reconcile before collecting COD.");
        sale.paid += sh.amount;
        sale.status = "Paid";
        sh.collected = sh.amount;
        journal(
          s,
          sh.orderRef,
          "COD collected at post office",
          [dr("Cash", sh.amount), cr("Courier receivable", sh.amount)],
          now,
        );
      }
      sh.status = status;
      break;
    }
    case "addReload": {
      const provider = str(p.provider, "Provider", 80);
      const type = choice(p.type, [
        "Top-up",
        "Reload",
        "Bill payment",
      ] as const);
      const amount = positive(p.amount);
      const providerRule = s.settings.providerRules.find(
        (rule) => rule.provider.toLowerCase() === provider.toLowerCase(),
      );
      const calculatedCommission =
        type === "Top-up" && providerRule?.recognition === "Top-up"
          ? rate(amount, providerRule.topupBonusPercent)
          : type !== "Top-up" && providerRule?.recognition === "Transaction"
            ? rate(amount, providerRule.transactionCommissionPercent)
            : 0;
      const commission = money(
        p.commission ?? calculatedCommission,
        "Commission",
      );
      const balance = s.reloads
        .filter((r) => r.provider === provider)
        .reduce(
          (a, r) =>
            a +
            (r.type === "Top-up"
              ? r.amount + r.commission
              : -r.amount + r.commission),
          0,
        );
      if (type !== "Top-up" && amount > balance)
        fail(
          "Provider balance is insufficient. Record its opening top-up first.",
        );
      s.reloads.push({
        id: randomUUID(),
        provider,
        type,
        phone: phone(p.phone),
        amount,
        commission,
        date: now,
      });
      const wallet = `Provider wallet: ${provider}`;
      journal(
        s,
        provider,
        `${type} — manually verified amounts`,
        type === "Top-up"
          ? [
              dr(wallet, amount + commission),
              cr("Cash", amount),
              cr("Provider bonus pending allocation", commission),
            ]
          : [
              dr("Cash", amount),
              cr(wallet, amount),
              dr(wallet, commission),
              cr("Reload commission revenue", commission),
            ],
        now,
      );
      break;
    }
    case "setProviderRule": {
      const provider = str(p.provider, "Provider", 80);
      const rule = {
        provider,
        topupBonusPercent: percent(p.topupBonusPercent ?? 0),
        transactionCommissionPercent: percent(
          p.transactionCommissionPercent ?? 0,
        ),
        recognition: choice(p.recognition, [
          "Top-up",
          "Transaction",
          "Manual",
        ] as const),
      };
      const index = s.settings.providerRules.findIndex(
        (item) => item.provider.toLowerCase() === provider.toLowerCase(),
      );
      if (index >= 0) s.settings.providerRules[index] = rule;
      else s.settings.providerRules.push(rule);
      break;
    }
    case "addSupplier": {
      const name = str(p.name, "Supplier name");
      if (
        s.suppliers.some(
          (item) => item.name.toLowerCase() === name.toLowerCase(),
        )
      )
        fail("This supplier already exists.");
      s.suppliers.push({
        id: randomUUID(),
        name,
        phone: phone(p.phone),
        address: optional(p.address, 500),
        creditDays: money(p.creditDays ?? 0, "Credit days"),
        openingBalance: money(p.openingBalance ?? 0, "Opening balance"),
        paid: 0,
      });
      break;
    }
    case "createPurchaseOrder": {
      const supplier = find(s.suppliers, p.supplierId, "Supplier");
      if (!Array.isArray(p.lines) || !p.lines.length)
        fail("Add at least one purchase order line.");
      const lines = (p.lines as Record<string, unknown>[]).map((raw) => {
        const product = find(s.products, raw.productId, "Product");
        return {
          productId: product.id,
          productName: product.name,
          ordered: qty(raw.quantity),
          received: 0,
          unitCost: positive(raw.unitCost, "Unit cost"),
        };
      });
      const subtotal = lines.reduce(
        (sum, line) => sum + line.ordered * line.unitCost,
        0,
      );
      const discount = money(p.discount ?? 0, "Purchase discount");
      if (discount > subtotal)
        fail("Purchase discount exceeds the order subtotal.");
      const order = {
        id: randomUUID(),
        number: nextNumber("PO", s.purchaseOrders),
        supplierId: supplier.id,
        supplierName: supplier.name,
        lines,
        subtotal,
        discount,
        total: subtotal - discount,
        dueDate: date(p.dueDate),
        status: "Ordered" as const,
        createdAt: now,
      };
      s.purchaseOrders.push(order);
      detail = order.number;
      break;
    }
    case "receivePurchaseOrder": {
      const order = find(s.purchaseOrders, p.id, "Purchase order");
      if (["Received", "Cancelled"].includes(order.status))
        fail("This purchase order cannot receive more stock.");
      if (!Array.isArray(p.lines) || !p.lines.length)
        fail("Enter at least one received quantity.");
      let receiptTotal = 0;
      for (const raw of p.lines as Record<string, unknown>[]) {
        const lineIndex = money(raw.lineIndex, "Purchase order line");
        const line = order.lines[lineIndex];
        if (!line) fail("Purchase order line not found.");
        const quantity = qty(raw.quantity);
        if (quantity > line.ordered - line.received)
          fail(
            `Receipt exceeds the remaining order quantity for ${line.productName}.`,
          );
        const product = find(s.products, line.productId, "Product");
        const lot = str(raw.lot, "Lot number", 80);
        if (
          s.batches.some(
            (batch) => batch.productId === product.id && batch.lot === lot,
          )
        )
          fail("This product already has that lot number.");
        const imeis = Array.isArray(raw.imeis)
          ? raw.imeis.map((value) => str(value, "IMEI", 30))
          : [];
        if (
          product.serialized &&
          (imeis.length !== quantity ||
            new Set(imeis).size !== quantity ||
            imeis.some((imei) => !/^\d{15}$/.test(imei)))
        )
          fail("Provide one unique 15-digit IMEI per received phone.");
        const existing = new Set([
          ...s.batches.flatMap((batch) => batch.imeis),
          ...s.sales.flatMap((sale) =>
            sale.lines.map((item) => item.imei).filter(Boolean),
          ),
        ]);
        if (imeis.some((imei) => existing.has(imei)))
          fail("An IMEI is already recorded.");
        const gross = line.unitCost * quantity;
        const allocatedDiscount = Number(
          (BigInt(order.discount) * BigInt(gross)) /
            BigInt(order.subtotal || 1),
        );
        const effectiveUnitCost = Math.max(
          0,
          Math.round((gross - allocatedDiscount) / quantity),
        );
        const value = effectiveUnitCost * quantity;
        receiptTotal += value;
        s.batches.push({
          id: randomUUID(),
          productId: product.id,
          lot,
          supplier: order.supplierName,
          quantity,
          remaining: quantity,
          pricing: parsePricing(raw.pricing, getPricing(product)),
          unitCost: effectiveUnitCost,
          receivedAt: now,
          imeis,
        });
        product.stock += quantity;
        product.cost = effectiveUnitCost;
        line.received += quantity;
      }
      const paid = money(p.paid ?? 0, "Amount paid");
      if (paid > receiptTotal) fail("Payment exceeds this receipt value.");
      order.status = order.lines.every((line) => line.received === line.ordered)
        ? "Received"
        : "Partially received";
      const number = nextNumber("GRN", s.purchases);
      s.purchases.push({
        id: randomUUID(),
        number,
        supplier: order.supplierName,
        total: receiptTotal,
        paid,
        date: now,
        status: order.status === "Received" ? "Received" : "Partial",
      });
      journal(
        s,
        number,
        `Purchase order receipt ${order.number}`,
        [
          dr("Inventory", receiptTotal),
          cr("Cash", paid),
          cr("Accounts payable", receiptTotal - paid),
        ],
        now,
      );
      detail = number;
      break;
    }
    case "supplierPayment": {
      const supplier = find(s.suppliers, p.id ?? p.supplierId, "Supplier");
      const amount = positive(p.amount);
      supplier.paid += amount;
      journal(
        s,
        supplier.id,
        "Supplier payment",
        [
          dr("Accounts payable", amount),
          cr(
            account(
              choice(p.method ?? "Cash", [
                "Cash",
                "Card",
                "Bank transfer",
              ] as const),
            ),
            amount,
          ),
        ],
        now,
      );
      break;
    }
    case "createSupplierReturn":
    case "addSupplierReturn": {
      const supplier = find(s.suppliers, p.supplierId, "Supplier");
      const product = find(s.products, p.productId, "Product");
      const batch = find(s.batches, p.batchId, "Batch");
      if (
        batch.productId !== product.id ||
        batch.supplier.toLowerCase() !== supplier.name.toLowerCase()
      )
        fail("Batch does not match this supplier and product.");
      const quantity = qty(p.quantity);
      if (quantity > batch.remaining)
        fail("Return quantity exceeds available batch stock.");
      batch.remaining -= quantity;
      product.stock -= quantity;
      const amount = quantity * batch.unitCost;
      const resolution = choice(p.resolution ?? "Pending", [
        "Pending",
        "Credit note",
        "Replacement",
        "Refund",
      ] as const);
      const supplierReturn = {
        id: randomUUID(),
        supplierId: supplier.id,
        supplierName: supplier.name,
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        quantity,
        amount,
        reason: str(p.reason, "Return reason", 1000),
        resolution,
        status:
          resolution === "Pending"
            ? ("Pending" as const)
            : ("Settled" as const),
        createdAt: now,
        settledAt: resolution === "Pending" ? undefined : now,
      };
      s.supplierReturns.push(supplierReturn);
      journal(
        s,
        supplier.id,
        "Stock returned to supplier",
        [dr("Supplier return receivable", amount), cr("Inventory", amount)],
        now,
      );
      if (resolution !== "Pending") {
        const target =
          resolution === "Refund"
            ? "Cash"
            : resolution === "Credit note"
              ? "Accounts payable"
              : "Inventory";
        journal(
          s,
          supplierReturn.id,
          `Supplier return ${resolution.toLowerCase()}`,
          [dr(target, amount), cr("Supplier return receivable", amount)],
          now,
        );
      }
      break;
    }
    case "settleSupplierReturn": {
      const item = find(s.supplierReturns, p.id, "Supplier return");
      if (item.status === "Settled") fail("This return is already settled.");
      item.resolution = choice(p.resolution, [
        "Credit note",
        "Replacement",
        "Refund",
      ] as const);
      item.status = "Settled";
      item.settledAt = now;
      const target =
        item.resolution === "Refund"
          ? "Cash"
          : item.resolution === "Credit note"
            ? "Accounts payable"
            : "Inventory";
      journal(
        s,
        item.id,
        `Supplier return ${item.resolution.toLowerCase()}`,
        [
          dr(target, item.amount),
          cr("Supplier return receivable", item.amount),
        ],
        now,
      );
      break;
    }
    case "addAgent": {
      const name = str(p.name, "Agent name");
      s.agents.push({
        id: randomUUID(),
        name,
        phone: phone(p.phone),
        defaultSharePercent: percent(
          p.defaultSharePercent ?? s.settings.agentSharePercent,
        ),
        paidCommission: 0,
        active: true,
      });
      break;
    }
    case "payCommission": {
      const payeeType = choice(p.payeeType, ["Agent", "Staff"] as const);
      const payee =
        payeeType === "Agent"
          ? find(s.agents, p.payeeId, "Agent")
          : find(s.staff, p.payeeId, "Staff");
      const earned =
        payeeType === "Agent"
          ? s.sales
              .filter((sale) => sale.agentId === payee.id)
              .reduce((sum, sale) => sum + sale.agentCommission, 0)
          : s.sales
              .filter((sale) => sale.staffId === payee.id)
              .reduce((sum, sale) => sum + sale.commission, 0) +
            s.repairs
              .filter((repair) => repair.technicianStaffId === payee.id)
              .reduce((sum, repair) => sum + repair.commission, 0);
      const amount = positive(p.amount);
      if (amount > earned - payee.paidCommission)
        fail("Payment exceeds unpaid commission.");
      payee.paidCommission += amount;
      const method = choice(p.method ?? "Cash", [
        "Cash",
        "Card",
        "Bank transfer",
      ] as const);
      s.commissionSettlements.push({
        id: randomUUID(),
        payeeType,
        payeeId: payee.id,
        payeeName: payee.name,
        amount,
        method,
        createdAt: now,
      });
      journal(
        s,
        payee.id,
        "Commission paid",
        [
          dr(`${payeeType} commission payable`, amount),
          cr(account(method), amount),
        ],
        now,
      );
      break;
    }
    case "settleCod":
    case "collectCodBatch": {
      if (!Array.isArray(p.shipmentIds) || !p.shipmentIds.length)
        fail("Select at least one delivered shipment.");
      const shipments = (p.shipmentIds as unknown[]).map((id) =>
        find(s.shipments, id, "Shipment"),
      );
      if (
        shipments.some(
          (item) => item.status !== "Delivered" || item.settlementId,
        )
      )
        fail("Only unsettled delivered shipments can be settled.");
      const expected = shipments.reduce((sum, item) => sum + item.amount, 0);
      const received = money(p.received, "Amount received");
      const fees = money(p.fees ?? 0, "Courier fees");
      if (received + fees > expected)
        fail("Received amount and fees exceed the expected COD value.");
      const difference = expected - received - fees;
      const settlement = {
        id: randomUUID(),
        shipmentIds: shipments.map((item) => item.id),
        reference: str(p.reference, "Settlement reference", 100),
        expected,
        received,
        fees,
        difference,
        createdAt: now,
      };
      s.codSettlements.push(settlement);
      for (const shipment of shipments) {
        const sale = s.sales.find((item) => item.number === shipment.orderRef);
        if (sale) {
          sale.paid += shipment.amount;
          sale.status = sale.paid >= sale.total ? "Paid" : "Partial";
        }
        shipment.status = "Collected";
        shipment.collected = shipment.amount;
        shipment.settlementId = settlement.id;
      }
      journal(
        s,
        settlement.reference,
        "COD batch settlement",
        [
          dr("Cash", received),
          dr("Courier expense", fees),
          dr("COD settlement difference", difference),
          cr("Courier receivable", expected),
        ],
        now,
      );
      break;
    }
    case "createAlert": {
      const dueAt = str(p.dueAt, "Arrival time", 40);
      if (Number.isNaN(Date.parse(dueAt))) fail("Enter a valid arrival time.");
      const assignee = s.users?.find((item) => item.id === p.assigneeUserId);
      const traits = Array.isArray(p.packageTraits)
        ? [...new Set(p.packageTraits)].map((item) =>
            choice(item, ["Fragile", "Heavy", "Valuable", "Urgent"] as const),
          )
        : [];
      if (traits.length > 4) fail("Choose up to four package traits.");
      const paymentState = choice(p.paymentState ?? "Paid", [
        "Paid",
        "Due on collection",
        "Partial",
        "Unknown",
      ] as const);
      const amountDue = money(p.amountDue ?? 0, "Amount due");
      if (paymentState === "Paid" && amountDue)
        fail("A fully paid parcel cannot have an amount due.");
      s.alerts.push({
        id: randomUUID(),
        type: choice(p.alertType ?? "Bus arrival", [
          "Bus arrival",
          "Credit reminder",
          "Stock",
          "General",
        ] as const),
        title: str(p.title, "Alert title"),
        repairId: optional(p.repairId, 100) || undefined,
        parcelDescription: optional(p.parcelDescription, 500) || undefined,
        busRegistration: optional(p.busRegistration, 40) || undefined,
        busRoute: optional(p.busRoute, 100) || undefined,
        originLocation: optional(p.originLocation, 100) || undefined,
        arrivalLocation: optional(p.arrivalLocation, 100) || undefined,
        contactName: optional(p.contactName, 100) || undefined,
        contactPhone: phone(p.contactPhone) || undefined,
        secondaryPhone: phone(p.secondaryPhone) || undefined,
        pickupInstructions: optional(p.pickupInstructions, 500) || undefined,
        packageTraits: traits.length ? traits : undefined,
        paymentState,
        amountDue: amountDue || undefined,
        dueAt,
        assigneeUserId: optional(p.assigneeUserId, 100) || undefined,
        assigneeName:
          assignee?.name ?? (optional(p.assigneeName, 100) || undefined),
        minutesBefore: money(p.minutesBefore ?? 10, "Reminder minutes"),
        status: "Scheduled",
        createdAt: now,
      });
      break;
    }
    case "acknowledgeAlert": {
      const alert = find(s.alerts, p.id, "Alert");
      if (actor && !canAcknowledgeAlert(alert, actor))
        fail(
          "Only the assigned staff member or an alert manager can acknowledge this alert.",
        );
      if (["Cancelled", "Collected"].includes(alert.status))
        fail("This alert can no longer be acknowledged.");
      if (alert.status === "Acknowledged") break;
      alert.status = "Acknowledged";
      alert.acknowledgedAt = now;
      alert.acknowledgedById = actor?.id;
      alert.acknowledgedByName = actor?.name;
      detail = `${alert.title}: acknowledged by ${actor?.name || "staff"}`;
      break;
    }
    case "collectAlert": {
      const alert = find(s.alerts, p.id, "Alert");
      if (actor && !canAcknowledgeAlert(alert, actor))
        fail(
          "Only the assigned staff member or an alert manager can collect this alert.",
        );
      if (alert.status === "Collected") break;
      if (alert.status !== "Acknowledged")
        fail("Accept collection responsibility before confirming collection.");
      alert.status = "Collected";
      alert.collectedAt = now;
      alert.collectedById = actor?.id;
      alert.collectedByName = actor?.name;
      alert.actualAmountPaid = money(
        p.actualAmountPaid ?? 0,
        "Actual amount paid",
      );
      alert.collectionNote = optional(p.collectionNote, 500) || undefined;
      detail = `${alert.title}: collected by ${actor?.name || "staff"}`;
      break;
    }
    case "cancelAlert": {
      const alert = find(s.alerts, p.id, "Alert");
      if (["Acknowledged", "Collected"].includes(alert.status))
        fail("An accepted or collected alert cannot be cancelled.");
      alert.status = "Cancelled";
      break;
    }
    case "escalateAlert": {
      const alert = find(s.alerts, p.id, "Alert");
      if (["Acknowledged", "Collected", "Cancelled"].includes(alert.status))
        fail("This alert cannot be escalated.");
      alert.status = "Escalated";
      alert.escalatedAt = now;
      s.notifications.unshift({
        id: randomUUID(),
        title: `Escalated: ${alert.title}`,
        detail:
          alert.arrivalLocation ||
          alert.busRoute ||
          "Alert needs owner attention.",
        read: false,
        createdAt: now,
      });
      break;
    }
    case "clearRepairCredential": {
      const repair = find(s.repairs, p.id, "Repair");
      delete repair.credentialCiphertext;
      repair.hasCredential = false;
      detail = repair.number;
      break;
    }
    case "staffAdvance": {
      const staff = find(s.staff, p.id, "Staff");
      const amount = positive(p.amount);
      staff.advances += amount;
      journal(
        s,
        staff.id,
        "Salary advance",
        [dr("Staff advances", amount), cr("Cash", amount)],
        now,
      );
      break;
    }
    case "payroll": {
      const staff = find(s.staff, p.id, "Staff");
      const month = now.slice(0, 7);
      if (staff.payrollMonths?.includes(month))
        fail("Payroll has already been paid for this month.");
      const earned =
        s.sales
          .filter((sale) => sale.staffId === staff.id)
          .reduce((sum, sale) => sum + sale.commission, 0) +
        s.repairs
          .filter((repair) => repair.technicianStaffId === staff.id)
          .reduce((sum, repair) => sum + repair.commission, 0);
      const commission = Math.max(-staff.salary, earned - staff.paidCommission);
      const gross = staff.salary + commission;
      const recovered = Math.min(gross, staff.advances);
      const net = gross - recovered;
      if (!gross) fail("There is no salary or commission to pay.");
      journal(
        s,
        `${staff.id}/${month}`,
        "Monthly payroll",
        [
          dr("Salary expense", staff.salary),
          ...(commission >= 0
            ? [dr("Staff commission payable", commission)]
            : [cr("Staff commission payable", -commission)]),
          cr("Staff advances", recovered),
          cr("Cash", net),
        ],
        now,
      );
      staff.advances -= recovered;
      staff.paidCommission += commission;
      staff.payrollMonths = [...(staff.payrollMonths ?? []), month];
      break;
    }
    case "updateSettings": {
      s.settings = {
        ...s.settings,
        businessName: str(p.businessName, "Business name"),
        phone: phone(p.phone),
        address: optional(p.address, 500),
        dailyTarget: money(p.dailyTarget, "Daily target"),
        accessoryPercent: percent(p.accessoryPercent),
        agentSharePercent: percent(p.agentSharePercent),
        repairStaffPercent: percent(p.repairStaffPercent),
        commissionConfirmed: p.commissionConfirmed === true,
      };
      break;
    }
    case "configureSms": {
      const apiKey = optional(p.apiKey, 500);
      s.settings.smsEnabled = p.enabled === true;
      s.settings.smsSenderId = optional(p.senderId, 30);
      if (apiKey) {
        s.settings.smsApiKeyCiphertext = encryptSecret(apiKey);
        s.settings.smsApiKeyConfigured = true;
      }
      if (p.clearApiKey === true) {
        delete s.settings.smsApiKeyCiphertext;
        s.settings.smsApiKeyConfigured = false;
      }
      if (s.settings.smsEnabled && s.settings.smsApiKeyConfigured)
        s.sms
          .filter((message) => message.status === "Pending configuration")
          .forEach((message) => (message.status = "Queued"));
      break;
    }
    case "retrySms": {
      const message = find(s.sms, p.id, "SMS message");
      if (!s.settings.smsEnabled || !s.settings.smsApiKeyConfigured)
        fail("Configure the SMS gateway first.");
      message.status = "Queued";
      break;
    }
    case "readNotifications":
      s.notifications.forEach((n) => (n.read = true));
      break;
    case "recordCredentialReveal":
      detail = str(p.repairNumber, "Repair number", 80);
      break;
    case "markSms": {
      const message = find(s.sms, p.id, "SMS message");
      message.status = choice(p.status, ["Sent", "Failed"] as const);
      detail = message.phone;
      break;
    }
    case "processAlerts": {
      const at = new Date(now).getTime();
      for (const alert of s.alerts) {
        const due = new Date(alert.dueAt).getTime();
        if (
          alert.status === "Scheduled" &&
          at >= due - alert.minutesBefore * 60000
        ) {
          alert.status = "Due";
          s.notifications.unshift({
            id: randomUUID(),
            title: alert.title,
            detail:
              `${alert.busRoute || ""} ${alert.arrivalLocation || ""}`.trim() ||
              "Alert is due.",
            read: false,
            createdAt: now,
          });
        }
        if (alert.status === "Due" && at >= due) {
          alert.status = "Escalated";
          alert.escalatedAt = now;
          s.notifications.unshift({
            id: randomUUID(),
            title: `Escalated: ${alert.title}`,
            detail:
              "The assigned user did not acknowledge this alert before the expected time.",
            read: false,
            createdAt: now,
          });
          sms(
            s,
            s.settings.phone,
            `Fido LK owner alert: ${alert.title} was not acknowledged before ${alert.dueAt}.`,
            now,
          );
        }
      }
      break;
    }
    case "processCreditReminders": {
      const currentDay = new Date(`${now.slice(0, 10)}T00:00:00Z`).getTime();
      for (const sale of s.sales) {
        if (
          !sale.dueDate ||
          sale.status === "Paid" ||
          sale.status === "Returned" ||
          sale.paid >= sale.total
        )
          continue;
        const due = new Date(`${sale.dueDate}T00:00:00Z`).getTime();
        const daysLate = Math.floor((currentDay - due) / 86400000);
        if (daysLate < 0) continue;
        sale.creditReminderDaysSent ??= [];
        const reminderDay = [...s.settings.creditReminderDays]
          .sort((a, b) => b - a)
          .find((day) => day <= daysLate);
        if (
          reminderDay === undefined ||
          sale.creditReminderDaysSent.includes(reminderDay)
        )
          continue;
        const customer = find(s.customers, sale.customerId, "Customer");
        sms(
          s,
          customer.phone,
          `Fido LK reminder: ${sale.number} has LKR ${((sale.total - sale.paid) / 100).toFixed(2)} outstanding. Please contact the shop.`,
          now,
        );
        sale.creditReminderDaysSent.push(reminderDay);
      }
      break;
    }
    case "subscribePush": {
      const endpoint = str(p.endpoint, "Push endpoint", 3000);
      const existing = s.pushSubscriptions.find(
        (subscription) => subscription.endpoint === endpoint,
      );
      const record = {
        id: existing?.id ?? randomUUID(),
        userId: actor?.id ?? fail("A signed-in user is required."),
        endpoint,
        p256dh: str(p.p256dh, "Push key", 500),
        auth: str(p.auth, "Push authentication key", 500),
        createdAt: now,
      };
      if (existing) Object.assign(existing, record);
      else s.pushSubscriptions.push(record);
      break;
    }
    case "removePush":
      s.pushSubscriptions = s.pushSubscriptions.filter(
        (subscription) => subscription.endpoint !== p.endpoint,
      );
      break;
    case "importCsv": {
      const kind = choice(p.kind, [
        "products",
        "legacyProducts",
        "customers",
        "stock",
      ] as const);
      if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > 5000)
        fail("The import must contain between 1 and 5,000 records.");
      const importRows = p.rows as Record<string, unknown>[];
      let imported = 0;
      let skipped = 0;
      for (const [index, raw] of importRows.entries()) {
        const row = Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [
            key.trim().toLowerCase(),
            value,
          ]),
        );
        const rupees = (key: string) => {
          const value = Number(row[key] ?? 0);
          if (!Number.isFinite(value) || value < 0)
            fail(`Invalid ${key} on CSV row ${index + 2}.`);
          return Math.round(value * 100);
        };
        const legacyNumber = (key: string) => {
          const source = String(row[key] ?? "").trim();
          const normalized = source
            .replaceAll(",", "")
            .replace(/[^0-9.-]/g, "");
          const value = Number(normalized);
          if (!source || !Number.isFinite(value) || value < 0)
            fail(`Invalid ${key} on CSV row ${index + 2}.`);
          return value;
        };
        if (kind === "legacyProducts") {
          const name = String(row.product ?? "").trim();
          const sku = String(row.sku ?? "").trim();
          const actionText = String(row.action ?? "");
          if (!name || !sku || /add to location/i.test(name)) {
            skipped++;
            continue;
          }
          const cost = Math.round(legacyNumber("unit purchase price") * 100);
          const price = Math.round(legacyNumber("selling price") * 100);
          const stockValue = legacyNumber("current stock");
          if (!Number.isSafeInteger(stockValue))
            fail(`Current stock must be a whole unit on CSV row ${index + 2}.`);
          const location = String(row["business location"] ?? "").toLowerCase();
          const importedDepartment = location.includes("cloth")
            ? "Clothing"
            : location.includes("gift")
              ? "Gifts"
              : "Phones";
          const active = !/reactivate/i.test(actionText);
          let product = s.products.find(
            (item) => item.sku.toLowerCase() === sku.toLowerCase(),
          );
          if (product) {
            snapshotLegacyPrices(s);
            product.pricing = parsePricing({
              ...getPricing(product),
              Retail: price,
            });
            product.name = name;
            product.category =
              String(row.category ?? "").trim() || "Uncategorized";
            product.department = importedDepartment;
            product.price = price;
            product.cost = cost;
            product.active = active;
          } else {
            applyAction(
              s,
              {
                type: "newProduct",
                requestId: randomUUID(),
                payload: {
                  sku,
                  name,
                  category:
                    String(row.category ?? "").trim() || "Uncategorized",
                  department: importedDepartment,
                  price,
                  cost,
                  reorderLevel: 5,
                  serialized: false,
                  active,
                },
              },
              now,
              actor,
            );
            product = s.products.at(-1)!;
          }
          const lot = `OPENING-${sku}`.slice(0, 80);
          const openingExists = s.batches.some(
            (batch) => batch.productId === product.id && batch.lot === lot,
          );
          if (stockValue > 0 && !openingExists) {
            s.batches.push({
              id: randomUUID(),
              productId: product.id,
              lot,
              supplier: "Opening balance",
              pricing: getPricing(product),
              quantity: stockValue,
              remaining: stockValue,
              unitCost: cost,
              receivedAt: now,
              imeis: [],
            });
            product.stock = stockValue;
            const total = stockValue * cost;
            if (total)
              journal(
                s,
                `OPEN-${sku}`,
                "Opening inventory imported",
                [dr("Inventory", total), cr("Opening balance equity", total)],
                now,
              );
          }
          imported++;
          continue;
        }
        if (kind === "products")
          applyAction(
            s,
            {
              type: "newProduct",
              requestId: randomUUID(),
              payload: {
                sku: row.sku,
                name: row.name,
                category: row.category,
                department: row.department,
                price: rupees("price"),
                cost: rupees("cost"),
                reorderLevel: Number(row.reorderlevel ?? 0),
                serialized: /^(true|yes|1)$/i.test(String(row.serialized)),
              },
            },
            now,
            actor,
          );
        if (kind === "products") imported++;
        if (kind === "customers") {
          applyAction(
            s,
            {
              type: "createCustomer",
              requestId: randomUUID(),
              payload: {
                name: row.name,
                phone: row.phone,
                address: row.address,
              },
            },
            now,
            actor,
          );
          const customer = s.customers.at(-1)!;
          customer.address = optional(row.address, 500);
          imported++;
        }
        if (kind === "stock") {
          const product =
            s.products.find(
              (item) =>
                item.sku.toLowerCase() === String(row.sku).toLowerCase(),
            ) ?? fail(`SKU not found on CSV row ${index + 2}.`);
          applyAction(
            s,
            {
              type: "receiveStock",
              requestId: randomUUID(),
              payload: {
                productId: product.id,
                supplier: row.supplier,
                lot: row.lot,
                quantity: Number(row.quantity),
                unitCost: rupees("unitcost"),
                paid: rupees("paid"),
                imeis: String(row.imeis ?? "")
                  .split(/[|;\s]+/)
                  .filter(Boolean),
              },
            },
            now,
            actor,
          );
          imported++;
        }
      }
      detail = `${kind}: ${imported} imported${skipped ? `, ${skipped} skipped` : ""}`;
      break;
    }
    default:
      fail("Unknown action.");
  }
  s.audit.unshift({
    id: randomUUID(),
    action: action.type,
    detail,
    at: now,
    userId: actor?.id,
    userName: actor?.name,
  });
  return s;
}
