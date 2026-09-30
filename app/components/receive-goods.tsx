"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Package, Search, Trash2 } from "lucide-react";
import { getPricing, PRICE_TIERS, priceTierLabel } from "@/lib/pricing";
import { findProductByScannedSku } from "@/lib/product-scan";
import { nextLotNumber } from "@/lib/lots";
import type { Batch, PriceTier, Product, Supplier } from "@/lib/types";
import styles from "./receive-goods.module.css";

type Line = {
  key: string;
  productId: string;
  lot: string;
  lotEdited: boolean;
  quantity: string;
  unitCost: string;
  prices: Record<PriceTier, string>;
  imeis: string;
  fromBill?: boolean;
};

export type ReceivePayload = {
  supplier: string;
  reference?: string;
  paid: number;
  lines: {
    productId: string;
    lot: string;
    quantity: number;
    unitCost: number;
    pricing: Partial<Record<PriceTier, number>>;
    imeis: string[];
  }[];
};

const rupees = (cents?: number) =>
  cents === undefined ? "" : String(cents / 100);
const cents = (value: string) => Math.round(Number(value || 0) * 100);
const money = (value: number) =>
  `LKR ${(value / 100).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
const imeiList = (text: string) => text.split(/[\s,]+/).filter(Boolean);

/**
 * One delivery, many items. Each line becomes its own lot with its own cost
 * and prices; prices start from the last lot of the same item.
 */
export function ReceiveGoods({
  products,
  batches,
  suppliers,
  shopLabel,
  tierLabels,
  canScanBill,
  busy,
  onReceive,
  onClose,
  onToast,
}: {
  products: Product[];
  batches: Batch[];
  suppliers: Supplier[];
  shopLabel: string;
  tierLabels?: Partial<Record<PriceTier, string>>;
  canScanBill: boolean;
  busy: boolean;
  onReceive: (payload: ReceivePayload) => Promise<boolean>;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [payMode, setPayMode] = useState<"Cash" | "Credit" | "Part">("Credit");
  const [partPaid, setPartPaid] = useState("");
  const [scanning, setScanning] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => searchRef.current?.focus(), []);

  const activeProducts = products.filter((p) => p.active !== false);
  const matches = search.trim()
    ? activeProducts
        .filter((p) =>
          `${p.name} ${p.sku}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .slice(0, 8)
    : [];

  const suggestedLots = useMemo(() => {
    // Hand out fresh numbers in line order; typed lots keep their own value.
    let offset = 0;
    return lines.map((line) =>
      line.lotEdited ? line.lot : nextLotNumber(batches, new Date(), offset++),
    );
  }, [lines, batches]);

  function addProduct(
    product: Product,
    fromBill?: { quantity?: number | null; unitCost?: number | null },
  ) {
    const last = [...batches]
      .filter((b) => b.productId === product.id)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0];
    const pricing = getPricing(product, last);
    setLines((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        lot: "",
        lotEdited: false,
        quantity: String(fromBill?.quantity || 1),
        unitCost: fromBill?.unitCost
          ? String(fromBill.unitCost)
          : rupees(last?.unitCost ?? product.cost),
        prices: Object.fromEntries(
          PRICE_TIERS.map((tier) => [tier, rupees(pricing[tier])]),
        ) as Record<PriceTier, string>,
        imeis: "",
        fromBill: !!fromBill,
      },
    ]);
    setSearch("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  const update = (key: string, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * cents(line.unitCost),
    0,
  );
  const units = lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0),
    0,
  );
  const paid =
    payMode === "Cash" ? total : payMode === "Credit" ? 0 : cents(partPaid);
  const problems = lines.flatMap((line) => {
    const product = products.find((p) => p.id === line.productId)!;
    const qty = Number(line.quantity);
    const issues: string[] = [];
    if (!Number.isInteger(qty) || qty < 1)
      issues.push(`${product.name}: enter a whole quantity.`);
    if (!cents(line.prices.Retail))
      issues.push(`${product.name}: a retail price is needed.`);
    if (product.serialized && imeiList(line.imeis).length !== qty)
      issues.push(
        `${product.name}: scan ${qty} IMEI${qty === 1 ? "" : "s"} (${imeiList(line.imeis).length} so far).`,
      );
    return issues;
  });
  const canReceive =
    !busy &&
    lines.length > 0 &&
    supplier.trim().length > 0 &&
    !problems.length &&
    paid <= total;

  async function scanBill(file: File) {
    if (file.size > 5_000_000) {
      onToast("Image must be smaller than 5MB.");
      return;
    }
    setScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read the photo."));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature: "invoiceExtraction",
          language: "English",
          image: { mimeType: file.type || "image/jpeg", data: base64 },
        }),
      });
      if (!res.ok) throw new Error("Could not read the bill.");
      const bill = await res.json();
      let matched = 0;
      for (const line of bill.lines || []) {
        const product =
          (line.sku && findProductByScannedSku(activeProducts, line.sku)) ||
          activeProducts.find((p) =>
            p.name
              .toLowerCase()
              .includes(String(line.description).toLowerCase()),
          );
        if (product) {
          addProduct(product, line);
          matched++;
        }
      }
      const vendor = (bill.fields || []).find((f: { label: string }) =>
        /supplier|vendor|from/i.test(f.label),
      );
      if (vendor && !supplier) setSupplier(vendor.value);
      onToast(
        `Read ${bill.lines?.length || 0} line(s) from the bill, matched ${matched}. Check every line before receiving.`,
      );
    } catch (error) {
      onToast((error as Error).message);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div
      className={styles.screen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="grn-title"
    >
      <header className={styles.bar}>
        <button type="button" className={styles.back} onClick={onClose}>
          <ArrowLeft size={18} /> Close
        </button>
        <span className={styles.badge} aria-hidden="true">
          <Package size={20} />
        </span>
        <h1 id="grn-title">Receive stock</h1>
        <span className={styles.shop}>
          <i />
          Into {shopLabel} stock
        </span>
      </header>

      <div className={styles.body}>
        <section className={styles.main}>
          <div className={styles.head}>
            <label>
              Supplier
              <input
                list="grn-suppliers"
                value={supplier}
                placeholder="Who sent it?"
                onChange={(e) => setSupplier(e.target.value)}
              />
              <datalist id="grn-suppliers">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </label>
            <label>
              Their bill no.
              <input
                value={reference}
                placeholder="Optional"
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            {canScanBill && (
              <label className={styles.scanBill}>
                <Camera size={18} />
                {scanning ? "Reading bill…" : "Scan their bill"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={scanning}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) scanBill(file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <div className={styles.finder}>
            <label className={styles.search}>
              <Search size={20} />
              <input
                ref={searchRef}
                value={search}
                aria-label="Add an item to this delivery"
                placeholder="Scan or search an item to add it to this delivery"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const exact = findProductByScannedSku(activeProducts, search);
                  const pick =
                    exact || (matches.length === 1 ? matches[0] : null);
                  if (pick) addProduct(pick);
                  else if (search.trim())
                    onToast("No single item matches. Pick one from the list.");
                }}
              />
            </label>
            {matches.length > 0 && (
              <div
                className={styles.results}
                role="listbox"
                aria-label="Matching items"
              >
                {matches.map((p) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={p.id}
                    onClick={() => addProduct(p)}
                  >
                    <strong>{p.name}</strong>
                    <small>
                      {p.sku} · {p.stock} in stock
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className={styles.table}
            role="table"
            aria-label="Items in this delivery"
          >
            <div className={styles.row + " " + styles.th} role="row">
              <span role="columnheader">Item</span>
              <span role="columnheader">Lot no.</span>
              <span role="columnheader">Qty</span>
              <span role="columnheader">Unit cost</span>
              {PRICE_TIERS.map((tier) => (
                <span role="columnheader" key={tier}>
                  {priceTierLabel(tierLabels, tier)}
                </span>
              ))}
              <span role="columnheader">Line</span>
              <span role="columnheader" aria-label="Remove" />
            </div>
            {lines.map((line, index) => {
              const product = products.find((p) => p.id === line.productId)!;
              const lineTotal =
                Number(line.quantity || 0) * cents(line.unitCost);
              const scanned = imeiList(line.imeis).length;
              return (
                <div className={styles.line} role="row" key={line.key}>
                  <div className={styles.row}>
                    <span role="cell" className={styles.item}>
                      <strong>{product.name}</strong>
                      <small>
                        {line.fromBill
                          ? "From the bill · check it"
                          : product.sku}
                      </small>
                    </span>
                    <input
                      aria-label={`Lot number for ${product.name}`}
                      className={styles.lot}
                      value={suggestedLots[index]}
                      onChange={(e) =>
                        update(line.key, {
                          lot: e.target.value,
                          lotEdited: true,
                        })
                      }
                    />
                    <input
                      aria-label={`Quantity of ${product.name}`}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) =>
                        update(line.key, {
                          quantity: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                    <input
                      aria-label={`Unit cost of ${product.name}`}
                      inputMode="decimal"
                      value={line.unitCost}
                      onChange={(e) =>
                        update(line.key, { unitCost: e.target.value })
                      }
                    />
                    {PRICE_TIERS.map((tier) => (
                      <input
                        key={tier}
                        aria-label={`${priceTierLabel(tierLabels, tier)} price for ${product.name}`}
                        inputMode="decimal"
                        placeholder="—"
                        value={line.prices[tier]}
                        onChange={(e) =>
                          update(line.key, {
                            prices: { ...line.prices, [tier]: e.target.value },
                          })
                        }
                      />
                    ))}
                    <strong role="cell" className={styles.lineTotal}>
                      {money(lineTotal)}
                    </strong>
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`Remove ${product.name}`}
                      onClick={() =>
                        setLines((prev) =>
                          prev.filter((l) => l.key !== line.key),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {product.serialized && (
                    <label className={styles.imeis}>
                      <span>
                        IMEIs {scanned} of {line.quantity || 0}
                        {scanned === Number(line.quantity) &&
                          scanned > 0 &&
                          " ✓"}
                      </span>
                      <textarea
                        rows={2}
                        value={line.imeis}
                        placeholder="Scan each phone's IMEI"
                        onChange={(e) =>
                          update(line.key, { imeis: e.target.value })
                        }
                      />
                    </label>
                  )}
                </div>
              );
            })}
            {!lines.length && (
              <div className={styles.empty}>
                <strong>Nothing in this delivery yet</strong>
                <span>
                  Scan an item, search above, or scan their bill. Each item gets
                  its own lot number and prices.
                </span>
              </div>
            )}
            {lines.length > 0 && (
              <p className={styles.help}>
                Lot numbers are made for you; type over one to use your own.
                Prices start from the last lot of the same item. Changing them
                here only changes this lot.
              </p>
            )}
          </div>
        </section>

        <aside className={styles.side}>
          <div className={styles.card}>
            <span className={styles.eyebrow}>THIS DELIVERY</span>
            <div className={styles.kv}>
              <span>Items</span>
              <span>
                {lines.length} lines · {units} units
              </span>
            </div>
            <div className={styles.kv}>
              <span>New lots</span>
              <span>
                {suggestedLots.length
                  ? suggestedLots.length > 1
                    ? `${suggestedLots[0]} → ${suggestedLots.at(-1)}`
                    : suggestedLots[0]
                  : "—"}
              </span>
            </div>
            <div className={styles.rule} />
            <div className={styles.total}>
              <span>Cost</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <div className={styles.card}>
            <span className={styles.eyebrow}>PAY THE SUPPLIER</span>
            <div
              className={styles.segment}
              role="radiogroup"
              aria-label="Payment"
            >
              {(["Cash", "Part", "Credit"] as const).map((mode) => (
                <button
                  type="button"
                  role="radio"
                  key={mode}
                  aria-checked={payMode === mode}
                  className={payMode === mode ? styles.on : ""}
                  onClick={() => setPayMode(mode)}
                >
                  {mode === "Cash"
                    ? "Paid in full"
                    : mode === "Part"
                      ? "Part paid"
                      : "On credit"}
                </button>
              ))}
            </div>
            {payMode === "Part" && (
              <label className={styles.field}>
                Paid now (Rs.)
                <input
                  inputMode="decimal"
                  value={partPaid}
                  onChange={(e) => setPartPaid(e.target.value)}
                />
              </label>
            )}
            <div className={styles.kv}>
              <span>We'll owe {supplier.trim() || "them"}</span>
              <strong>{money(Math.max(0, total - paid))}</strong>
            </div>
            {paid > total && (
              <small className={styles.problem}>
                Paid is more than the cost.
              </small>
            )}
          </div>

          {problems.length > 0 && (
            <ul className={styles.problems} aria-live="polite">
              {problems.slice(0, 4).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className={styles.receive}
            disabled={!canReceive}
            onClick={async () => {
              const ok = await onReceive({
                supplier: supplier.trim(),
                reference: reference.trim() || undefined,
                paid,
                lines: lines.map((line, index) => ({
                  productId: line.productId,
                  lot: suggestedLots[index],
                  quantity: Number(line.quantity),
                  unitCost: cents(line.unitCost),
                  pricing: Object.fromEntries(
                    PRICE_TIERS.filter((tier) => line.prices[tier] !== "").map(
                      (tier) => [tier, cents(line.prices[tier])],
                    ),
                  ),
                  imeis: imeiList(line.imeis),
                })),
              });
              if (ok) onClose();
            }}
          >
            {busy ? "Receiving…" : "Receive into stock"}
          </button>
          {!supplier.trim() && lines.length > 0 && (
            <small className={styles.hint}>Add the supplier to finish.</small>
          )}
        </aside>
      </div>
    </div>
  );
}
