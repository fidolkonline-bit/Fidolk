"use client";

import { useMemo, useState } from "react";
import { History, Plus, Search, X } from "lucide-react";
import { findProductByScannedSku } from "@/lib/product-scan";
import { costChange, purchaseHistory } from "@/lib/purchase-history";
import type {
  Batch,
  Department,
  Product,
  PurchaseOrder,
  Workspace,
} from "@/lib/types";
import styles from "./po-item.module.css";

export type NewItem = {
  name: string;
  sku: string;
  department: Department;
  category: string;
  retail: number;
  cost: number;
  serialized: boolean;
};

const rs = (cents: number) =>
  `Rs. ${(cents / 100).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Colombo",
  });
// Plain digits read like a scanned barcode, so they make a good SKU.
const looksLikeBarcode = (text: string) => /^\d{6,}$/.test(text.trim());
const blockEnter = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") e.preventDefault();
};

/**
 * The item on one purchase order line: search or scan to pick it, add it on
 * the spot when it is new, and see what we paid for it before.
 */
export function PoItem({
  productId,
  unitCost,
  supplier,
  products,
  batches,
  purchaseOrders,
  canAddProduct,
  busy,
  onPick,
  onCreate,
}: {
  productId: string;
  /** In cents, as typed on the line. */
  unitCost: number;
  supplier?: string;
  products: Product[];
  batches: Batch[];
  purchaseOrders: PurchaseOrder[];
  canAddProduct: boolean;
  busy: boolean;
  /** `suggestedCost` is in cents. */
  onPick: (productId: string, suggestedCost: number) => void;
  onCreate: (item: NewItem) => Promise<Workspace | null>;
}) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<
    (Omit<NewItem, "retail" | "cost"> & { retail: string; cost: string }) | null
  >(null);
  const [error, setError] = useState("");
  const active = products.filter((p) => p.active !== false);
  const product = products.find((p) => p.id === productId);
  const term = search.trim().toLowerCase();
  const matches = term
    ? active
        .filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(term))
        .slice(0, 6)
    : [];
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  function pick(p: Product) {
    const h = purchaseHistory(p.id, batches, purchaseOrders, supplier);
    onPick(
      p.id,
      h.lastFromSupplier?.unitCost ?? h.last?.unitCost ?? p.cost ?? 0,
    );
    setSearch("");
  }

  function startNew() {
    const text = search.trim();
    setError("");
    setDraft({
      name: looksLikeBarcode(text) ? "" : text,
      sku: looksLikeBarcode(text) ? text : "",
      department: "Phones",
      category: "",
      retail: "",
      cost: unitCost ? String(unitCost / 100) : "",
      serialized: false,
    });
  }

  async function saveNew() {
    if (!draft) return;
    const sku = draft.sku.trim();
    if (!draft.name.trim() || !sku || !draft.category.trim()) {
      setError("Name, SKU and category are needed.");
      return;
    }
    if (products.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) {
      setError("That SKU is already used by another item.");
      return;
    }
    setError("");
    const cost = Math.round(Number(draft.cost || 0) * 100);
    const updated = await onCreate({
      name: draft.name.trim(),
      sku,
      department: draft.department,
      category: draft.category.trim(),
      retail: Math.round(Number(draft.retail || 0) * 100),
      cost,
      serialized: draft.serialized,
    });
    const created = updated?.products.find(
      (p) => p.sku.toLowerCase() === sku.toLowerCase(),
    );
    if (!created) return;
    onPick(created.id, cost);
    setDraft(null);
    setSearch("");
  }

  if (product) {
    const h = purchaseHistory(product.id, batches, purchaseOrders, supplier);
    const change = costChange(
      unitCost,
      h.lastFromSupplier?.unitCost ?? h.last?.unitCost,
    );
    const low = product.stock <= product.reorderLevel;
    return (
      <div className={styles.picked}>
        <div className={styles.title}>
          <div>
            <strong>{product.name}</strong>
            <small>
              {product.sku} · {product.category}
            </small>
          </div>
          <button
            type="button"
            className={styles.change}
            onClick={() => onPick("", 0)}
          >
            Change
          </button>
        </div>
        <div className={styles.facts}>
          <span className={low ? styles.warn : ""}>
            <small>In stock</small>
            <b>
              {product.stock}
              {low && ` · reorder at ${product.reorderLevel}`}
            </b>
          </span>
          <span className={h.onOrder ? styles.warn : ""}>
            <small>Already on order</small>
            <b>
              {h.onOrder
                ? `${h.onOrder} on ${h.openOrders.join(", ")}`
                : "None"}
            </b>
          </span>
          <span>
            <small>Last cost</small>
            <b>
              {h.last
                ? `${rs(h.last.unitCost)} · ${shortDate(h.last.date)}`
                : "Never bought"}
            </b>
            {h.last && <small>{h.last.supplier}</small>}
          </span>
          {supplier && (
            <span>
              <small>Last from {supplier}</small>
              <b>
                {h.lastFromSupplier
                  ? `${rs(h.lastFromSupplier.unitCost)} · ${shortDate(h.lastFromSupplier.date)}`
                  : "Never from them"}
              </b>
            </span>
          )}
          {h.lowest && h.receipts.length > 1 && (
            <span>
              <small>Lowest paid</small>
              <b>{rs(h.lowest.unitCost)}</b>
              <small>{h.lowest.supplier}</small>
            </span>
          )}
        </div>
        {change !== undefined && change !== 0 && (
          <p className={change > 0 ? styles.dearer : styles.cheaper}>
            {change > 0
              ? `${change}% more than last time`
              : `${-change}% less than last time`}
          </p>
        )}
        {h.receipts.length > 0 && (
          <details className={styles.history}>
            <summary>
              <History size={14} /> Past deliveries ({h.receipts.length})
              {h.averageCost !== undefined && ` · average ${rs(h.averageCost)}`}
            </summary>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Qty</th>
                  <th>Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {h.receipts.slice(0, 8).map((r) => (
                  <tr key={r.lot}>
                    <td>{shortDate(r.date)}</td>
                    <td>{r.supplier}</td>
                    <td>{r.quantity}</td>
                    <td>{rs(r.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    );
  }

  if (draft) {
    const set = (patch: Partial<typeof draft>) =>
      setDraft((d) => (d ? { ...d, ...patch } : d));
    return (
      <div className={styles.newItem}>
        <div className={styles.title}>
          <strong>New item</strong>
          <button
            type="button"
            className={styles.change}
            aria-label="Cancel new item"
            onClick={() => setDraft(null)}
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.grid}>
          <label className={styles.wide}>
            Name
            <input
              autoFocus={!draft.name}
              value={draft.name}
              onKeyDown={blockEnter}
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
          <label>
            SKU / barcode
            <input
              autoFocus={!!draft.name}
              value={draft.sku}
              onKeyDown={blockEnter}
              onChange={(e) => set({ sku: e.target.value })}
            />
          </label>
          <label>
            Shop
            <select
              value={draft.department}
              onChange={(e) =>
                set({ department: e.target.value as Department })
              }
            >
              {(["Phones", "Clothing", "Gifts"] as const).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <input
              list="po-item-categories"
              value={draft.category}
              onKeyDown={blockEnter}
              onChange={(e) => set({ category: e.target.value })}
            />
            <datalist id="po-item-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Retail price (Rs.)
            <input
              inputMode="decimal"
              placeholder="Can wait till it arrives"
              value={draft.retail}
              onKeyDown={blockEnter}
              onChange={(e) => set({ retail: e.target.value })}
            />
          </label>
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.serialized}
            onChange={(e) => set({ serialized: e.target.checked })}
          />
          Phone with an IMEI (track each unit)
        </label>
        {error && <p className={styles.dearer}>{error}</p>}
        <button
          type="button"
          className={styles.save}
          disabled={busy}
          onClick={saveNew}
        >
          {busy ? "Adding…" : "Add item and use it here"}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.finder}>
      <label className={styles.search}>
        <Search size={16} />
        <input
          value={search}
          aria-label="Item"
          placeholder="Search or scan an item"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const exact = findProductByScannedSku(active, search);
            const only = exact || (matches.length === 1 ? matches[0] : null);
            if (only) pick(only);
            else if (term && !matches.length && canAddProduct) startNew();
          }}
        />
      </label>
      {term && (
        <div className={styles.results} role="listbox" aria-label="Items">
          {matches.map((p) => {
            const last = purchaseHistory(p.id, batches, []).last;
            return (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={p.id}
                onClick={() => pick(p)}
              >
                <strong>{p.name}</strong>
                <small>
                  {p.sku} · {p.stock} in stock
                  {last && ` · last ${rs(last.unitCost)}`}
                </small>
              </button>
            );
          })}
          {canAddProduct ? (
            <button type="button" className={styles.add} onClick={startNew}>
              <Plus size={15} />
              <span>
                Add “{search.trim()}” as a new item
                {!matches.length && <small>Not in our items yet</small>}
              </span>
            </button>
          ) : (
            !matches.length && (
              <p className={styles.none}>
                Not in our items. Ask someone who can add items.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
