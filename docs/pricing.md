# Product and batch selling prices

All prices are stored as integer cents and entered as rupees in the app.

## Configure prices

- New product: enter Retail, optional Wholesale/VIP/Agent prices, and optional minimum/maximum selling prices.
- GRN (Receive stock): the selected product's defaults are copied into the form. Adjust them for this receipt. Changing product selection resets these fields.
- Purchase-order receipt: set prices for each received line, including partial deliveries.
- Existing products: Inventory → Batches → Edit product defaults.
- Existing stock: Inventory → Batches → Edit prices on the relevant batch.

Changing defaults affects future receipts only. Changing a batch affects future sales only; completed invoices and returns use saved sale values. Older stock starts with its previous Retail price and no other tiers or limits. Blank optional prices are unavailable, not zero. Zero is an explicit value. Minimum must not exceed maximum, and configured tiers must be within the limits.

## Make a sale

Choose the customer at POS; new customers can have a preferred price tier. Each cart item can use that default or an explicitly selected tier. Accessories consume FIFO stock and show separate batch prices when the requested quantity spans receipts. Phones use the selected IMEI's batch. A tier missing on any consumed batch prevents completion; select a configured tier or have an authorized user configure that batch.

Extra discounts are per unit: either rupees or a percentage. Percentage discounts round to the nearest cent. An optional invoice discount is then allocated proportionally across lines, preserving every cent. The final total after both discounts is checked against each batch's limits and actual cost.

Wholesale and Agent prices do not imply a commission. The referring agent remains a separate choice. Commissions use actual discounted revenue and actual consumed stock costs.

## Permissions and overrides

The owner has all capabilities. Existing staff accounts keep their current permissions; the owner can grant these under Team & payroll:

- Select wholesale, VIP & agent prices (`sales.priceTier`).
- Apply extra and invoice discounts (`sales.discount`).
- Override selling prices and limits (`sales.priceOverride`).

Manual unit prices require override permission and a reason. Prices below cost or outside the configured limits require the same permission and a reason. A reason without permission cannot bypass a limit. The sale and audit log record the reason and actor. New sales/service presets include tiers and discounts, but not price overrides.

The server calculates prices independently and checks these permissions. It rejects checkout if stock or pricing no longer matches the displayed quote. Refresh and review the sale in that case.

## Historical accuracy

Each new sale line records its tier, original tier price, manual base price (if used), per-unit discount, batch/IMEI, limits, invoice-discount allocation, net line total, cost allocations, and any override reason. Partial refunds use cumulative allocations of that recorded net total so returning all units refunds precisely the line's original net amount. Old invoices remain readable without these additional fields.
