"use client";

import JsBarcode from "jsbarcode";
import { Printer, ScanLine } from "lucide-react";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Product, Settings } from "@/lib/types";

function ProductBarcode({ sku }: { sku: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, sku, {
      format: "CODE128",
      displayValue: false,
      height: 44,
      width: 1.35,
      margin: 8,
      background: "#ffffff",
      lineColor: "#000000",
    });
  }, [sku]);

  return (
    <svg
      ref={ref}
      className="product-barcode"
      role="img"
      aria-label={`Barcode for SKU ${sku}`}
    />
  );
}

export function ProductLabel({
  product,
  settings,
  price,
  height,
  setHeight,
  quantity,
  setQuantity,
  onPrint,
  onClose,
}: {
  product: Product;
  settings: Settings;
  price: string;
  height: 25 | 30 | 40;
  setHeight: Dispatch<SetStateAction<25 | 30 | 40>>;
  quantity: number;
  setQuantity: Dispatch<SetStateAction<number>>;
  onPrint: () => void;
  onClose: () => void;
}) {
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
        <label>
          <span>Print quantity</span>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={quantity}
            onChange={(event) =>
              setQuantity(
                Math.min(100, Math.max(1, Number(event.target.value) || 1)),
              )
            }
          />
        </label>
      </div>
      <div className="label-preview-stage product-label-stage">
        <div className="product-label-sheet">
          {Array.from({ length: quantity }, (_, index) => (
            <div
              className="product-label-paper"
              key={index}
              style={{ "--label-height": `${height}mm` } as CSSProperties}
              aria-hidden={index > 0 ? true : undefined}
            >
              <div className="product-label-brand">
                <strong>{settings.businessName}</strong>
                <span>{price}</span>
              </div>
              <div className="product-label-name">{product.name}</div>
              <ProductBarcode sku={product.sku} />
              <div className="product-label-sku">{product.sku}</div>
            </div>
          ))}
        </div>
        {quantity > 1 && (
          <span className="product-label-stack-count no-print">
            {quantity} identical labels
          </span>
        )}
      </div>
      <div className="product-label-guidance no-print">
        <ScanLine size={18} aria-hidden="true" />
        <p>
          The label encodes only <strong>SKU {product.sku}</strong>. Set the
          MP6300Y to USB keyboard mode with an Enter suffix, then test one label
          before printing a batch.
        </p>
      </div>
      <div className="modal-footer no-print document-actions">
        <button className="secondary" onClick={onClose}>
          Back
        </button>
        <button className="primary" onClick={onPrint}>
          <Printer size={16} /> Print{" "}
          {quantity === 1 ? "label" : `${quantity} labels`}
        </button>
      </div>
    </>
  );
}
