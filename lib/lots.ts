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
