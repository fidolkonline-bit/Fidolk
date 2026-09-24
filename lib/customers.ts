import type { Customer, Sale, Shipment } from "./types";

export function saleBalance(sale: Sale): number {
  return sale.status === "Returned"
    ? 0
    : Math.max(0, sale.total - sale.paid - (sale.returnedTotal ?? 0));
}

export function canonicalSriLankanPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+94${digits.slice(1)}`;
  if (/^94\d{9}$/.test(digits)) return `+${digits}`;
  return "";
}

export function phoneSearchDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  const canonical = canonicalSriLankanPhone(value).replace(/\D/g, "");
  if (canonical) return canonical;
  if (digits.startsWith("0")) return `94${digits.slice(1)}`;
  return digits;
}

export function isWalkInCustomer(customer: Customer): boolean {
  return customer.id === "cust-walkin";
}

export function isActiveCodSale(sale: Sale, shipments: Shipment[]): boolean {
  return shipments.some(
    (shipment) =>
      shipment.orderRef === sale.number &&
      ["Packed", "Shipped", "Delivered"].includes(shipment.status),
  );
}

export function customerOpenInvoices(
  customerId: string,
  sales: Sale[],
  shipments: Shipment[] = [],
): Sale[] {
  return sales
    .filter(
      (sale) =>
        sale.customerId === customerId &&
        sale.status !== "Returned" &&
        saleBalance(sale) > 0 &&
        !isActiveCodSale(sale, shipments),
    )
    .sort(
      (a, b) =>
        (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}

export function customerFinancialSummary(
  customer: Customer,
  sales: Sale[],
  shipments: Shipment[] = [],
  now = new Date(),
) {
  const customerSales = sales.filter(
    (sale) => sale.customerId === customer.id && sale.status !== "Returned",
  );
  const openInvoices = customerSales
    .filter((sale) => saleBalance(sale) > 0)
    .sort(
      (a, b) =>
        (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const collectibleInvoices = customerOpenInvoices(
    customer.id,
    sales,
    shipments,
  );
  const today = now.toISOString().slice(0, 10);
  const overdueInvoices = openInvoices.filter(
    (sale) => !!sale.dueDate && sale.dueDate < today,
  );
  return {
    sales: customerSales,
    openInvoices,
    collectibleInvoices,
    overdueInvoices,
    totalSales: customerSales.reduce((sum, sale) => sum + sale.total, 0),
    outstanding: openInvoices.reduce((sum, sale) => sum + saleBalance(sale), 0),
    collectibleOutstanding: collectibleInvoices.reduce(
      (sum, sale) => sum + saleBalance(sale),
      0,
    ),
    overdue: overdueInvoices.reduce((sum, sale) => sum + saleBalance(sale), 0),
    lastSaleAt: customerSales
      .map((sale) => sale.createdAt)
      .sort()
      .at(-1),
  };
}

export function allocateCustomerPayment(
  invoices: Sale[],
  amount: number,
): { saleId: string; number: string; amount: number }[] {
  let remaining = amount;
  const allocations = [];
  for (const sale of invoices) {
    const applied = Math.min(remaining, saleBalance(sale));
    if (applied > 0)
      allocations.push({
        saleId: sale.id,
        number: sale.number,
        amount: applied,
      });
    remaining -= applied;
    if (!remaining) break;
  }
  return allocations;
}

export function customerMatches(customer: Customer, query: string): boolean {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return true;
  const digits = phoneSearchDigits(query);
  return (
    customer.name.toLocaleLowerCase().includes(text) ||
    (!!digits && phoneSearchDigits(customer.phone).includes(digits))
  );
}
