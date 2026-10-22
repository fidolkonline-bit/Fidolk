import type { Batch } from "./types";

/**
 * Lot numbers look like LOT-2609-004: year and month of receipt, then a
 * running number for that month across every product. `offset` reserves
 * numbers for further lines on the same delivery.
 */
export function nextLotNumber(
  batches: readonly Pick<Batch, "lot">[],
  at: string | Date = new Date(),
  offset = 0,
): string {
  const d = typeof at === "string" ? new Date(at) : at;
  const month = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "2-digit",
    month: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((parts, p) => {
      parts[p.type] = p.value;
      return parts;
    }, {});
  const prefix = `LOT-${month.year}${month.month}-`;
  const highest = batches.reduce((max, b) => {
    if (!b.lot.startsWith(prefix)) return max;
    const n = Number(b.lot.slice(prefix.length));
    return Number.isInteger(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${String(highest + 1 + offset).padStart(3, "0")}`;
}

/**
 * Lot stickers carry a short number per product (1, 2, 3…) rather than the
 * whole lot number, so the barcode stays short enough for a 38 mm sticker.
 */
export function nextLabelNo(
  batches: readonly Pick<Batch, "productId" | "labelNo">[],
  productId: string,
): number {
  return (
    batches.reduce(
      (max, b) =>
        b.productId === productId && (b.labelNo ?? 0) > max ? b.labelNo! : max,
      0,
    ) + 1
  );
}

/** Numbers every lot that has no sticker number yet, oldest first. */
export function numberLots<T extends Batch>(batches: T[]): T[] {
  if (batches.every((b) => b.labelNo)) return batches;
  const highest = new Map<string, number>();
  for (const b of batches)
    if (b.labelNo)
      highest.set(
        b.productId,
        Math.max(highest.get(b.productId) ?? 0, b.labelNo),
      );
  const assigned = new Map<string, number>();
  for (const b of batches
    .filter((b) => !b.labelNo)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))) {
    const labelNo = (highest.get(b.productId) ?? 0) + 1;
    highest.set(b.productId, labelNo);
    assigned.set(b.id, labelNo);
  }
  return batches.map((b) =>
    b.labelNo ? b : { ...b, labelNo: assigned.get(b.id) },
  );
}

/** What a lot sticker's barcode holds: the SKU, a dash, the lot's number. */
export const lotBarcode = (sku: string, labelNo: number) => `${sku}-${labelNo}`;
