"use client";

import JsBarcode from "jsbarcode";
import { Printer, ScanLine } from "lucide-react";
import {
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { lotBarcode } from "@/lib/lots";
import { getPricing } from "@/lib/pricing";
import type { Batch, Product, Settings } from "@/lib/types";

/** One kind of sticker: a product, usually one of its lots, and how many. */
export type StickerRow = {
  key: string;
  product: Product;
  lot?: Batch;
  quantity: number;
};

export const MAX_STICKERS = 500;

/** What the barcode holds: SKU-n for a lot, the SKU alone otherwise. */
export const stickerCode = (row: Pick<StickerRow, "product" | "lot">) =>
  row.lot?.labelNo
    ? lotBarcode(row.product.sku, row.lot.labelNo)
    : row.product.sku;

// Drawn once per sticker kind and reused, so a few hundred stickers stay quick.
function barcodeImage(value: string) {
  if (typeof document === "undefined") return "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, {
    format: "CODE128",
    displayValue: false,
    height: 44,
    width: 1.35,
    margin: 8,
    background: "#ffffff",
    lineColor: "#000000",
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    new XMLSerializer().serializeToString(svg),
  )}`;
}

export function ProductLabel({
  rows,
  setRows,
  lotChoices,
  settings,
  formatMoney,
  height,
  setHeight,
  onPrint,
  onClose,
}: {
  rows: StickerRow[];
  setRows: Dispatch<SetStateAction<StickerRow[]>>;
  /** Lots in stock to choose from, when printing for a single product. */
  lotChoices?: Batch[];
  settings: Settings;
  formatMoney: (cents: number) => string;
  height: 25 | 30 | 40;
  setHeight: Dispatch<SetStateAction<25 | 30 | 40>>;
  onPrint: () => void;
  onClose: () => void;
}) {
  const [previewKey, setPreviewKey] = useState(rows[0]?.key);
  const preview = rows.find((row) => row.key === previewKey) || rows[0];
  const images = useMemo(
    () =>
      Object.fromEntries(
        rows.map((row) => [row.key, barcodeImage(stickerCode(row))]),
      ),
    [rows],
  );
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  const setQuantity = (key: string, value: number) =>
    setRows((list) =>
      list.map((row) =>
        row.key === key
          ? {
              ...row,
              quantity: Math.min(MAX_STICKERS, Math.max(0, value || 0)),
            }
          : row,
      ),
    );
  const single = rows.length === 1 ? rows[0] : undefined;

  return (
    <>
      <div className="label-config product-label-config no-print">
        <label>
          <span>Label height</span>
          <select
            value={height}
            onChange={(event) =>
              setHeight(Number(event.target.value) as 25 | 30 | 40)
            }
          >
            <option value={25}>25 mm</option>
            <option value={30}>30 mm</option>
            <option value={40}>40 mm</option>
          </select>
        </label>
        {single && lotChoices && lotChoices.length > 0 && (
          <label>
            <span>Lot</span>
            <select
              value={single.lot?.id || ""}
              onChange={(event) => {
                const lot = lotChoices.find((b) => b.id === event.target.value);
                if (!lot) return;
                setRows([
                  {
                    ...single,
                    lot,
                    quantity: Math.min(MAX_STICKERS, lot.remaining),
                  },
                ]);
              }}
            >
              {lotChoices.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lot} · {lot.remaining} left
                </option>
              ))}
            </select>
          </label>
        )}
        {single && (
          <label>
            <span>How many</span>
            <input
              type="number"
              min={1}
              max={MAX_STICKERS}
              step={1}
              value={single.quantity}
              onChange={(event) =>
                setQuantity(single.key, Number(event.target.value))
              }
            />
          </label>
        )}
      </div>
      {rows.length > 1 && (
        <ul className="sticker-rows no-print">
          {rows.map((row) => (
            <li
              key={row.key}
              className={row.key === preview?.key ? "is-active" : undefined}
            >
              <button
                type="button"
                className="sticker-row-name"
                onClick={() => setPreviewKey(row.key)}
              >
                <strong>{row.product.name}</strong>
                <small>{row.lot ? `Lot ${row.lot.lot}` : "No lot"}</small>
              </button>
              <input
                type="number"
                min={0}
                max={MAX_STICKERS}
                step={1}
                value={row.quantity}
                aria-label={`Stickers for ${row.product.name}`}
                onChange={(event) =>
                  setQuantity(row.key, Number(event.target.value))
                }
              />
            </li>
          ))}
        </ul>
      )}
      <div className="label-preview-stage product-label-stage">
        <div className="product-label-sheet">
          {rows.flatMap((row) => {
            const price = getPricing(row.product, row.lot).Retail;
            return Array.from({ length: row.quantity }, (_, index) => {
              const isPreview = row.key === preview?.key && index === 0;
              return (
                <div
                  className={`product-label-paper${isPreview ? " is-preview" : ""}`}
                  key={`${row.key}-${index}`}
                  style={{ "--label-height": `${height}mm` } as CSSProperties}
                  aria-hidden={isPreview ? undefined : true}
                >
                  <div className="product-label-brand">
                    <strong>{settings.businessName}</strong>
                    <span>{formatMoney(price ?? row.product.price)}</span>
                  </div>
                  <div className="product-label-name">{row.product.name}</div>
                  <img
                    className="product-barcode"
                    src={images[row.key]}
                    alt={`Barcode ${stickerCode(row)}`}
                  />
                  <div className="product-label-sku">
                    {row.lot
                      ? `${row.product.sku} · ${row.lot.lot}`
                      : row.product.sku}
                  </div>
                </div>
              );
            });
          })}
        </div>
        {total > 1 && (
          <span className="product-label-stack-count no-print">
            {total} stickers
          </span>
        )}
      </div>
      <div className="product-label-guidance no-print">
        <ScanLine size={18} aria-hidden="true" />
        <p>
          {preview?.lot ? (
            <>
              Scanning this sticker at Sell adds{" "}
              <strong>lot {preview.lot.lot}</strong> straight to the bill.
            </>
          ) : (
            <>This sticker has no lot, so Sell will ask which lot it is.</>
          )}{" "}
          Print one and test it with the scanner before printing the rest.
        </p>
      </div>
      <div className="modal-footer no-print document-actions">
        <button className="secondary" onClick={onClose}>
          Back
        </button>
        <button className="primary" disabled={!total} onClick={onPrint}>
          <Printer size={16} /> Print{" "}
          {total === 1 ? "sticker" : `${total} stickers`}
        </button>
      </div>
    </>
  );
}
