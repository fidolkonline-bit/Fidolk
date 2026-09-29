"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { getPricing, priceTierLabel } from "@/lib/pricing";
import type { Batch, PriceTier, Product } from "@/lib/types";
import styles from "./lot-picker.module.css";

export type LotChoice = { batchId: string; quantity: number };

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-LK", { maximumFractionDigits: 2 });
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Colombo",
  });

/**
 * Every item asks which lot it comes from, even when only one lot is in
 * stock. When the chosen lot is short, it asks where the rest comes from.
 */
export function LotPicker({
  product,
  batches,
  inCart,
  tier,
  tierLabels,
  initialQuantity = 1,
  onAdd,
  onClose,
}: {
  product: Product;
  batches: Batch[];
  /** Units of each lot already in the cart, by batch id. */
  inCart: Record<string, number>;
  tier: PriceTier;
  tierLabels?: Partial<Record<PriceTier, string>>;
  initialQuantity?: number;
  onAdd: (choices: LotChoice[]) => void;
  onClose: () => void;
}) {
  const lots = useMemo(
    () =>
      batches
        .filter((b) => b.productId === product.id)
        .map((b) => ({ batch: b, left: b.remaining - (inCart[b.id] || 0) }))
        .filter((l) => l.left > 0)
        .sort((a, b) => b.batch.receivedAt.localeCompare(a.batch.receivedAt)),
    [batches, inCart, product.id],
  );
  const [lotId, setLotId] = useState(lots[0]?.batch.id || "");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [restFrom, setRestFrom] = useState("");
  const addRef = useRef<HTMLButtonElement>(null);
  useEffect(() => addRef.current?.focus(), []);

  const chosen = lots.find((l) => l.batch.id === lotId) || lots[0];
  const left = chosen?.left || 0;
  const short = quantity > left;
  const rest = Math.max(0, quantity - left);
  const restOptions = lots.filter(
    (l) => l.batch.id !== chosen?.batch.id && l.left >= rest,
  );
  const blocked = !chosen || (short && !restFrom);
  const priceOf = (b: Batch) => {
    const pricing = getPricing(product, b);
    return pricing[tier] ?? pricing.Retail;
  };
  const restLot = lots.find((l) => l.batch.id === restFrom);
  const label = !chosen
    ? "No stock left"
    : short
      ? restLot
        ? `Add ${left} from ${chosen.batch.lot} + ${rest} from ${restLot.batch.lot}`
        : `Choose a lot for the other ${rest}`
      : `Add ${quantity} from ${chosen.batch.lot}`;

  const submit = () => {
    if (blocked) return;
    onAdd(
      short && restLot
        ? [
            { batchId: chosen.batch.id, quantity: left },
            { batchId: restLot.batch.id, quantity: rest },
          ]
        : [{ batchId: chosen.batch.id, quantity }],
    );
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="lot-picker-title"
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <header className={styles.head}>
          <div>
            <span className={styles.eyebrow}>WHICH LOT?</span>
            <h2 id="lot-picker-title">{product.name}</h2>
            <p>
              {lots.length > 1
                ? `${lots.length} lots in stock. Each keeps its own cost and prices.`
                : "One lot in stock. Check it and press Enter."}
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

        <div className={styles.lots} role="radiogroup" aria-label="Stock lots">
          {lots.map(({ batch, left: lotLeft }) => {
            const on = batch.id === chosen?.batch.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={on}
                key={batch.id}
                className={`${styles.lot} ${on ? styles.on : ""}`}
                onClick={() => {
                  setLotId(batch.id);
                  setRestFrom("");
                }}
              >
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.lotText}>
                  <strong>{batch.lot}</strong>
                  <small>
                    Received {shortDate(batch.receivedAt)}
                    {batch.supplier ? ` · ${batch.supplier}` : ""}
                  </small>
                </span>
                <span className={styles.lotPrice}>
                  <strong>{money(priceOf(batch))}</strong>
                  <small className={lotLeft <= 5 ? styles.low : ""}>
                    {lotLeft} left
                  </small>
                </span>
              </button>
            );
          })}
          {!lots.length && (
            <p className={styles.empty}>
              Every lot of this item is already in the sale or sold out.
            </p>
          )}
        </div>

        <div className={styles.qty}>
          <span>Quantity</span>
          <button
            type="button"
            aria-label="Fewer"
            onClick={() => {
              setQuantity((q) => Math.max(1, q - 1));
              setRestFrom("");
            }}
          >
            <Minus size={16} />
          </button>
          <input
            aria-label="Quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ""));
              setQuantity(Math.max(1, Math.min(9999, n || 1)));
              setRestFrom("");
            }}
          />
          <button
            type="button"
            aria-label="More"
            onClick={() => {
              setQuantity((q) => q + 1);
              setRestFrom("");
            }}
          >
            <Plus size={16} />
          </button>
        </div>

        {chosen && short && (
          <div className={styles.short} role="status">
            <p>
              <strong>
                {chosen.batch.lot} only has {left}.
              </strong>{" "}
              Where should the other {rest} come from?
            </p>
            <div>
              {restOptions.map(({ batch }) => (
                <button
                  type="button"
                  key={batch.id}
                  aria-pressed={restFrom === batch.id}
                  className={restFrom === batch.id ? styles.on : ""}
                  onClick={() => setRestFrom(batch.id)}
                >
                  Take {rest} from {batch.lot}
                </button>
              ))}
              {!restOptions.length && (
                <small>No other lot has enough. Lower the quantity.</small>
              )}
            </div>
          </div>
        )}

        <button
          ref={addRef}
          className={styles.add}
          type="submit"
          disabled={blocked}
        >
          {label}
          <kbd>Enter</kbd>
        </button>
        <p className={styles.tier}>
          Prices at {priceTierLabel(tierLabels, tier)}
        </p>
      </form>
    </div>
  );
}
