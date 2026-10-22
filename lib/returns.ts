import { saleBalance } from "./customers";
import type { PaymentMethod, Sale, SaleReturn } from "./types";

/** How a refund can be paid out at the counter. */
export const REFUND_METHODS = ["Cash", "Card", "Bank transfer"] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

/** A refund goes back the way the bill was paid, or as cash. */
export function defaultRefundMethod(sale: Sale): RefundMethod {
  const paidBy: PaymentMethod | undefined =
    (sale.payments ?? [])
      .map((receipt) => receipt.method)
      .filter((method) => method !== "Store credit")
      .at(-1) ?? sale.method;
  return (REFUND_METHODS as readonly string[]).includes(paidBy)
    ? (paidBy as RefundMethod)
    : "Cash";
}

/** Units of a bill line already returned. */
export function returnedUnits(
  previous: readonly SaleReturn[],
  lineIndex: number,
): number {
  return previous
    .flatMap((item) => item.items)
    .filter((item) => item.lineIndex === lineIndex)
    .reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * What returning `quantity` more units of a line gives back: the price the
 * customer actually paid, after discounts, cent-exact across partial returns.
 */
export function lineRefund(
  sale: Sale,
  lineIndex: number,
  already: number,
  quantity: number,
): number {
  const line = sale.lines[lineIndex];
  const gross = line.price * quantity;
  return line.total !== undefined
    ? Number(
        (BigInt(line.total) * BigInt(already + quantity)) /
          BigInt(line.quantity),
      ) - Number((BigInt(line.total) * BigInt(already)) / BigInt(line.quantity))
    : gross -
        Number(
          (BigInt(sale.discount) * BigInt(gross)) / BigInt(sale.subtotal || 1),
        );
}

/**
 * How a return's value is settled. It first cancels what the customer still
 * owes on the bill; store credit they spent on it comes back as store credit;
 * the rest is paid out, or credited for an exchange.
 */
export function settleReturn(
  sale: Sale,
  previous: readonly SaleReturn[],
  total: number,
) {
  const owedCancelled = Math.min(total, saleBalance(sale));
  const paidPortion = total - owedCancelled;
  const creditSpent = (sale.payments ?? [])
    .filter((receipt) => receipt.method === "Store credit")
    .reduce((sum, receipt) => sum + receipt.amount, 0);
  const creditGivenBack = previous.reduce(
    (sum, item) => sum + (item.storeCreditRestored ?? 0),
    0,
  );
  const storeCreditRestored = Math.min(
    paidPortion,
    Math.max(0, creditSpent - creditGivenBack),
  );
  return {
    owedCancelled,
    storeCreditRestored,
    payout: paidPortion - storeCreditRestored,
  };
}
