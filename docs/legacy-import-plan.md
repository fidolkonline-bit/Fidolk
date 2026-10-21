# Clicky POS product and stock import: plan

Source files (gitignored, exported 21 October 2026):

- `old-system-export/clicky-products-2026-10-21.csv` — 2,904 products
- `old-system-export/clicky-stock-report-2026-10-21.csv` — 2,907 product × shop stock rows, with FIFO stock value

Built: `npm run import:prepare-clicky -- <products.csv> <stock-report.csv>` writes `clicky-prepared.csv` next to the exports, rehearses the import on an empty in-memory workspace and lists every flagged row. `npm run import:legacy-products -- clicky-prepared.csv` (dry run, then `--commit`) loads it into the real database.

Dry run on the 21 October export: 2,884 products (Phones 2,503, Clothing 286, Gifts 95), 1,282 opening lots, Rs 3,535,943 opening inventory, which matches the stock report and the opening journal.

## Approach

The new system already has a Clicky import (`importCsv` kind `legacyProducts` in `lib/business.ts`, run by `npm run import:legacy-products`). It was written for the products screen's own "Export to CSV" columns. Rather than a second importer, a small script will join our two CSVs into rows of that shape and pass them through the same action, with three fixes to the action itself (see "Changes to the existing importer").

```
products.csv ─┐
              ├─ scripts/prepare-clicky-import.ts ─► review report (every flagged row)
stock.csv ────┘                                   └► legacyProducts rows ─► importCsv (dry run, then --commit)
```

Dry run is the default and prints counts plus every flagged row. Nothing is written without `--commit`.

## Field mapping

| New system | Taken from | Notes |
| --- | --- | --- |
| `sku` | products `sku` | Kept as-is, so printed barcodes keep scanning. Duplicates: see below |
| `name` | products `product` | HTML and WooCommerce icon already stripped |
| `category` | products `category`, plus ` -- sub_category` when set | 134 categories kept as they are; empty → `Uncategorized` |
| `brand` | products `brand` | Only 60 products have one. Left blank otherwise; brands are **not** guessed from names (a "Samsung A12 back cover" isn't made by Samsung) |
| `department` | shop | Apple By Fido → Phones, Trendy By Fido → Clothing, Wow Gifts By Fido → Gifts |
| `price` (Retail) | products `selling_price_max` | Min and max are equal for every product |
| `cost` | stock value ÷ stock quantity (FIFO) when in stock; otherwise products `purchase_price_max` | 176 in-stock products have a FIFO cost different from the list price; FIFO is what the stock on the shelf actually cost |
| `stock` + opening lot | stock report `current_stock` for that shop | One lot `OPENING-<sku>` per product with stock, supplier "Opening balance", unit cost as above |
| `reorderLevel` | products `alert_quantity` | Falls back to 5 when blank |
| `active` | products `inactive`, plus the rules below | |
| `serialized` | false | IMEIs aren't in either export. Phones that need IMEI tracking are switched on afterwards |

Result: **2,884 products**, **1,283 opening lots**, **4,709 units**, about **Rs 3.54M** of opening inventory at cost. It is posted as one journal per product: Inventory against Opening balance equity, as the importer does today.

## Problem rows and how each is handled

| Problem | Rows | Handling |
| --- | ---: | --- |
| **Reload and bill-payment "stock"** (Dialog, Mobitel, Hutch, Airtel, Mega Pay, CEB, Water, Insurance, Other Reloads, Online Transfer) | 12 | **Not imported as products.** The new system tracks reloads as provider balances, not shelf stock. The old "stock" adds up to Rs 477,646 of face value and is unlikely to be accurate. On cutover day, enter each provider's real balance from its app as an opening top-up |
| **Services that don't hold stock** (Repairing In-shop/Outsource, Apple ID Setup, Labour, Courier, Bank Charges, Other Incomes, Other CCTV) | 8 | **Not imported.** Repairs, expenses and other income already have their own screens in the new system |
| **Duplicate SKUs** — six numbers each used by two different products, usually one phone item and one clothing item | 12 | The Phones product keeps the number and the other gets a `T` prefix (e.g. `T2954`). Two of those have stock (LUICCI Pants 36 ×3, US POLO Shirt XL ×1) and need new labels. Pair `3353` is two phone items; the one in stock keeps the number and the other becomes `B3353`. Without this, the existing importer would silently merge each pair into one product |
| **Negative stock** (MARCO POLO Short L and XL, −1 each at Trendy) | 2 | Imported with **0 stock** and flagged for a shelf count. The −1 came from a typing mistake in opening stock, not real sales |
| **Negative stock value** (FIFO mix-ups: something sold before its purchase was entered) | 8 | 7 have 0 stock, so only the product comes across. **iPhone 11 128GB Black** has 1 in stock with value −Rs 51,500, so it gets the list cost of Rs 67,000 and is flagged for the owner to confirm |
| **Cost higher than price** (Redmi A7 Pro 4GB/64GB: cost 56,900, price 47,990, 1 in stock) | 1 | Imported as-is and flagged. Either the price or the cost is wrong. (Smart Watch 8 Ultra too, with 0 stock) |
| **Zero selling price** — Fido.lk Premium Quality Bag (345 in stock), 13 Pro Max Camera Lence | 2 | The bags are packaging, so they're imported **inactive** with stock, so they can't be sold by accident and still count in inventory. The lens is imported inactive until it has a price |
| **No shop assigned** (13 Pro Max Camera Lence, Chilli Flakes, Turmeric, iPhone 12 Silicon Covers "new") | 4 | Imported **inactive**, department Phones; none has stock |
| **Placeholder names** (`zzzzz…`, "Inactive", "Not Use") | 4 | Imported inactive. One has stock, which is flagged |
| **Duplicate names** — the same product entered twice under different SKUs | 48 rows / 24 names | Imported as separate products (they have different barcodes) and listed in the report. In 6 cases both copies have stock, so merging them is a later clean-up, not part of the import |
| **Products with zero stock** | 1,611 | Imported active, so a restock doesn't need any extra steps (agreed) |
| **Stock in two shops** (3 Pieces Water Bottle 2l: 1 at Apple, 1 at Wow Gifts) | 1 | Quantities and FIFO value added together; department follows the product's assigned shop |
| **Used 22" monitors** — FIFO cost Rs 16,133 against price Rs 14,900, 3 in stock | 1 | Imported as-is and flagged with the other cost-above-price items |

## Changes to the existing importer

1. **Department by shop.** Today only names containing "cloth" or "gift" map away from Phones, so every Trendy product would land in **Phones**. Add Trendy → Clothing (and keep Wow Gifts → Gifts).
2. **Refuse duplicate SKUs within one file.** Today a repeated SKU overwrites the earlier row. The import should stop and name both rows. The prepare script resolves them first, so this is a safety net.
3. **Negative stock.** Today the whole import stops at the first negative quantity. Prepared rows never contain one, so this stays strict. No change needed.

Each change gets a test in `tests/business.test.ts`, next to the existing legacy import test.

## Cutover

1. Agree the decisions below.
2. Build the prepare script and importer fixes; run a dry run against a copy of the database and review the flagged list together.
3. On cutover day, after closing: re-export both CSVs (stock moves daily, so today's files are only for rehearsal), `npm run backup`, dry run, then `--commit`.
4. Enter real provider balances for reloads; count the flagged items (MARCO POLO shorts, iPhone 11, Redmi A7 Pro, bags).
5. Keep Clicky POS read-only for reference until the first month-end in the new system closes cleanly.

**Not covered:** customers and their dues, open supplier dues, purchase/sale history, and the WooCommerce sync (2,826 products are linked to the website). Each needs its own plan before Clicky POS is switched off.

## Decisions needed

1. **Duplicate SKUs:** Phones keeps the number and clothing gets a `T` prefix, with 2 items relabelled. OK?
2. **Zero-stock products (1,611):** import all of them active (recommended, so nothing is missing when stock arrives), or import only products that have stock and add the rest on first purchase?
3. **Reload balances:** enter real provider balances on cutover day (recommended), or carry over Clicky's numbers?
