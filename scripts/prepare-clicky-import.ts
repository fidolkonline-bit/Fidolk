import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { parseCsv } from "../lib/csv";
import { createEmptyWorkspace } from "../lib/seed";
import type { AuthUser } from "../lib/types";

/**
 * Joins the Clicky POS product list and stock report exports into rows for
 * the `legacyProducts` import, then rehearses that import on an empty
 * workspace in memory. Nothing is written to the database. See
 * docs/legacy-import-plan.md for why each rule exists.
 */

const actor: AuthUser = {
  id: "migration",
  name: "Legacy product migration",
  username: "migration",
  role: "System",
  permissions: ["*"],
  active: true,
};

type Row = Record<string, string>;
interface Flag {
  sku: string;
  product: string;
  note: string;
}

const num = (value: string | undefined) => {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : 0;
};
const isReload = (row: Row) =>
  row.category.trim() === "Reloads" ||
  /^(other reloads|online transer)$/i.test(row.product.trim());
const isPlaceholder = (name: string) =>
  /^z{3,}/i.test(name.trim()) || /\binactive\b|\bnot use\b/i.test(name);
const csvValue = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

async function main() {
  const [productsPath, stockPath] = process.argv.slice(2);
  if (!productsPath || !stockPath)
    throw new Error(
      "Usage: npm run import:prepare-clicky -- products.csv stock-report.csv",
    );
  const products = parseCsv(await readFile(resolve(productsPath), "utf8"));
  const stock = parseCsv(await readFile(resolve(stockPath), "utf8"));

  const stockByProduct = new Map<string, Row[]>();
  for (const row of stock)
    stockByProduct.set(row.product_id, [
      ...(stockByProduct.get(row.product_id) ?? []),
      row,
    ]);

  const flags: Record<string, Flag[]> = {
    "Skipped: reload or bill payment": [],
    "Skipped: service, no stock kept": [],
    "SKU changed: repeated in Clicky": [],
    "Stock in more than one shop, added together": [],
    "Negative stock, imported as 0": [],
    "Negative stock value, list cost used": [],
    "Cost above selling price": [],
    "Imported inactive": [],
    "Same name as another product": [],
  };
  const flag = (group: string, row: Row, note = "") =>
    flags[group].push({ sku: row.sku, product: row.product, note });

  const kept = products.filter((row) => {
    if (isReload(row)) {
      flag(
        "Skipped: reload or bill payment",
        row,
        `${row.current_stock_all_locations} units`,
      );
      return false;
    }
    if (row.manage_stock === "0") {
      flag("Skipped: service, no stock kept", row);
      return false;
    }
    return true;
  });

  // Repeated SKUs: Phones keeps the number, a clothing item gets a T prefix,
  // and between two items of the same shop the one with stock keeps it.
  const sku = new Map(kept.map((row) => [row.product_id, row.sku.trim()]));
  const taken = new Set(kept.map((row) => row.sku.trim().toLowerCase()));
  const bySku = new Map<string, Row[]>();
  for (const row of kept)
    bySku.set(row.sku.trim().toLowerCase(), [
      ...(bySku.get(row.sku.trim().toLowerCase()) ?? []),
      row,
    ]);
  for (const group of bySku.values()) {
    if (group.length < 2) continue;
    const keeper =
      group.find((row) => /apple/i.test(row.locations)) &&
      group.some((row) => /trendy/i.test(row.locations))
        ? group.find((row) => /apple/i.test(row.locations))!
        : [...group].sort(
            (a, b) =>
              num(b.current_stock_all_locations) -
              num(a.current_stock_all_locations),
          )[0];
    for (const row of group) {
      if (row === keeper) continue;
      const prefix = /trendy/i.test(row.locations) ? "T" : "B";
      let next = `${prefix}${row.sku.trim()}`;
      while (taken.has(next.toLowerCase())) next = `${prefix}${next}`;
      taken.add(next.toLowerCase());
      sku.set(row.product_id, next);
      flag(
        "SKU changed: repeated in Clicky",
        row,
        `${row.sku} → ${next}; ${num(row.current_stock_all_locations)} in stock, needs a new label`,
      );
    }
  }

  const nameCount = new Map<string, number>();
  for (const row of kept) {
    const key = row.product.trim().toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }

  const prepared = kept.map((row) => {
    // A few products hold stock in two shops; the new system keeps one count.
    const shopRows = stockByProduct.get(row.product_id) ?? [];
    const rawQuantity = shopRows.reduce(
      (sum, s) => sum + num(s.current_stock),
      0,
    );
    const quantity = Math.max(0, rawQuantity);
    const value = shopRows.reduce(
      (sum, s) => sum + num(s.stock_value_purchase),
      0,
    );
    if (shopRows.filter((s) => num(s.current_stock) > 0).length > 1)
      flag(
        "Stock in more than one shop, added together",
        row,
        shopRows
          .filter((s) => num(s.current_stock) > 0)
          .map((s) => `${s.location} ${num(s.current_stock)}`)
          .join(", "),
      );
    const listCost = num(row.purchase_price_max);
    const price = num(row.selling_price_max);
    let cost = listCost;
    if (quantity > 0 && value > 0)
      cost = Math.round((value / quantity) * 100) / 100;
    if (rawQuantity < 0)
      flag("Negative stock, imported as 0", row, `Clicky shows ${rawQuantity}`);
    if (value < 0)
      flag(
        "Negative stock value, list cost used",
        row,
        `${quantity} in stock, Clicky value ${value}`,
      );
    if (price > 0 && cost > price)
      flag(
        "Cost above selling price",
        row,
        `cost ${cost}, price ${price}, ${quantity} in stock`,
      );
    const inactiveReason =
      row.inactive === "1"
        ? "inactive in Clicky"
        : price === 0
          ? "no selling price"
          : !row.locations
            ? "no shop"
            : isPlaceholder(row.product)
              ? "placeholder name"
              : "";
    if (inactiveReason)
      flag("Imported inactive", row, `${inactiveReason}; ${quantity} in stock`);
    if ((nameCount.get(row.product.trim().toLowerCase()) ?? 0) > 1)
      flag("Same name as another product", row, `${quantity} in stock`);
    return {
      Action: inactiveReason ? "Reactivate" : "",
      Product: row.product.trim(),
      "Business Location": row.locations,
      "Unit Purchase Price": cost.toFixed(2),
      "Selling Price": price.toFixed(2),
      "Current stock": String(quantity),
      Category: row.category.trim(),
      Brand: row.brand.trim(),
      SKU: sku.get(row.product_id)!,
      "Alert quantity": row.alert_quantity
        ? String(num(row.alert_quantity))
        : "",
    };
  });

  const out = resolve(dirname(resolve(productsPath)), "clicky-prepared.csv");
  const headers = Object.keys(prepared[0]);
  await writeFile(
    out,
    [
      headers.join(","),
      ...prepared.map((row) =>
        headers.map((key) => csvValue(row[key as keyof typeof row])).join(","),
      ),
    ].join("\n") + "\n",
  );

  // Rehearse the real import on an empty workspace.
  const s = applyAction(
    createEmptyWorkspace(),
    {
      type: "importCsv",
      payload: { kind: "legacyProducts", rows: prepared },
      requestId: randomUUID(),
    },
    undefined,
    actor,
  );
  const rupees = (cents: number) =>
    `Rs ${(cents / 100).toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
  const departments = ["Phones", "Clothing", "Gifts"] as const;
  const inventory = s.batches.reduce(
    (sum, batch) => sum + batch.remaining * batch.unitCost,
    0,
  );
  const journal = s.journal.reduce(
    (sum, entry) =>
      sum +
      entry.lines
        .filter((line) => line.account === "Inventory")
        .reduce((total, line) => total + line.debit - line.credit, 0),
    0,
  );

  console.log(`\nPrepared ${prepared.length} rows → ${out}\n`);
  console.log("Dry run on an empty workspace (nothing saved):");
  console.table(
    Object.fromEntries(
      departments.map((department) => {
        const items = s.products.filter((p) => p.department === department);
        const ids = new Set(items.map((p) => p.id));
        const lots = s.batches.filter((b) => ids.has(b.productId));
        return [
          department,
          {
            products: items.length,
            active: items.filter((p) => p.active !== false).length,
            "in stock": items.filter((p) => p.stock > 0).length,
            units: items.reduce((sum, p) => sum + p.stock, 0),
            "stock at cost": rupees(
              lots.reduce((sum, b) => sum + b.remaining * b.unitCost, 0),
            ),
          },
        ];
      }),
    ),
  );
  console.log(
    `Opening lots ${s.batches.length}, inventory ${rupees(inventory)}, journal to Inventory ${rupees(journal)}${inventory === journal ? " (matches)" : " (DOES NOT MATCH)"}`,
  );
  console.log(`Audit: ${s.audit[0]?.detail}\n`);
  for (const [group, items] of Object.entries(flags)) {
    console.log(`${group} (${items.length})`);
    for (const item of items)
      console.log(
        `  ${item.sku} | ${item.product}${item.note ? ` | ${item.note}` : ""}`,
      );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Prepare failed.");
  process.exitCode = 1;
});
