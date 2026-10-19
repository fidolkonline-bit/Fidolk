"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Product } from "@/lib/types";
import styles from "./brand-editor.module.css";

/** Most products a list shows at once; search narrows the rest. */
const SHOWN = 200;

/**
 * Sets the brand on one product or many at once. Opened from a product row it
 * starts with that product ticked; opened on its own it lists the products
 * that still have no brand.
 */
export function BrandEditor({
  products,
  initialIds = [],
  busy,
  onSave,
  onClose,
}: {
  products: Product[];
  initialIds?: string[];
  busy: boolean;
  onSave: (productIds: string[], brand: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const single =
    initialIds.length === 1
      ? products.find((p) => p.id === initialIds[0])
      : undefined;
  const [brand, setBrand] = useState(single?.brand ?? "");
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(!initialIds.length);
  const [ticked, setTicked] = useState(() => new Set(initialIds));
  const brandRef = useRef<HTMLInputElement>(null);
  useEffect(() => brandRef.current?.focus(), []);

  const brands = useMemo(
    () =>
      [
        ...new Set(products.map((p) => p.brand).filter(Boolean) as string[]),
      ].sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const matching = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter(
      (p) =>
        (!onlyMissing || !p.brand || ticked.has(p.id)) &&
        words.every((word) =>
          `${p.name} ${p.sku} ${p.category} ${p.brand ?? ""}`
            .toLowerCase()
            .includes(word),
        ),
    );
  }, [products, query, onlyMissing, ticked]);
  const shown = matching.slice(0, SHOWN);
  const missing = products.filter((p) => !p.brand).length;
  const allShownTicked =
    shown.length > 0 && shown.every((p) => ticked.has(p.id));

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const tickShown = () =>
    setTicked((prev) => {
      const next = new Set(prev);
      for (const p of shown)
        if (allShownTicked) next.delete(p.id);
        else next.add(p.id);
      return next;
    });

  const typed = brand.trim();
  const count = ticked.size;
  const unchanged = !!single && typed === (single.brand ?? "");
  const blocked = !count || unchanged || busy;
  const label = !count
    ? "Tick the products to brand"
    : unchanged
      ? "Type a brand"
      : typed
        ? `Set ${typed} on ${count} product${count === 1 ? "" : "s"}`
        : `Remove the brand from ${count} product${count === 1 ? "" : "s"}`;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-editor-title"
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (blocked) return;
          if (await onSave([...ticked], typed)) onClose();
        }}
      >
        <header className={styles.head}>
          <div>
            <span className={styles.eyebrow}>BRAND</span>
            <h2 id="brand-editor-title">
              {single ? single.name : "Set brands"}
            </h2>
            <p>
              {single
                ? "Past sales keep the brand they were sold under."
                : `${missing} product${missing === 1 ? " has" : "s have"} no brand yet. Tick a few, type the brand once.`}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <label className={styles.brand}>
          <span>Brand</span>
          <input
            ref={brandRef}
            list="brand-editor-brands"
            value={brand}
            maxLength={80}
            placeholder="e.g. Apple, Samsung, Spigen"
            onChange={(e) => setBrand(e.target.value)}
          />
          <datalist id="brand-editor-brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>

        {!single && (
          <>
            <div className={styles.filters}>
              <input
                type="search"
                aria-label="Find products"
                placeholder="Find products, e.g. case iphone 15"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={onlyMissing}
                  onChange={(e) => setOnlyMissing(e.target.checked)}
                />
                Only ones with no brand
              </label>
            </div>
            <div className={styles.listHead}>
              <button
                type="button"
                className={styles.textButton}
                disabled={!shown.length}
                onClick={tickShown}
              >
                {allShownTicked
                  ? "Untick these"
                  : `Tick all ${shown.length} shown`}
              </button>
              <small>
                {count} ticked
                {matching.length > SHOWN &&
                  ` · showing ${SHOWN} of ${matching.length}, search to narrow`}
              </small>
            </div>
            <div className={styles.list}>
              {shown.map((p) => (
                <label
                  key={p.id}
                  className={`${styles.row} ${ticked.has(p.id) ? styles.on : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={ticked.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.sku} · {p.category} ·{" "}
                      {p.brand ? <b>{p.brand}</b> : <i>No brand</i>}
                    </small>
                  </span>
                </label>
              ))}
              {!shown.length && (
                <p className={styles.empty}>
                  {onlyMissing && !query
                    ? "Every product has a brand."
                    : "No products match."}
                </p>
              )}
            </div>
          </>
        )}

        <button className={styles.save} type="submit" disabled={blocked}>
          {label}
        </button>
      </form>
    </div>
  );
}
