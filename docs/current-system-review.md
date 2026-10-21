# Existing Fido Clicky POS: read-only workflow review

Inspected on 11 October 2026. This records observed behaviour in the existing live system, not an approved specification for the replacement.

## Inspection boundary

Only navigation, display filters/search, blank form inspection, and existing record views were used. No form was submitted, cash register opened, transaction created, commission generated, notification sent, or record/settings changed. The POS entry point redirected to **Open Cash Register**; that workflow was left untouched. Application code was not changed.

Personal contact details and bank information are intentionally excluded from these notes.

## System structure

The footer identifies Clicky POS V4.7.8. Locations shown are Apple By Fido, Trendy By Fido, and Wow Gifts By Fido. Purchases, sales, stock history, and reports carry a business location.

Navigation includes user management/roles, supplier/customer contacts, products/categories, repairs, purchases and purchase orders/returns, sales and sales returns, shipments, stock transfers/adjustments, expenses, payment accounts, reporting, HRM, and WooCommerce.

## Reloads

### Observed

- Reloads are ordinary **Single** products in a **Reloads** category, with stock management enabled for the inspected Dialog Reload product.
- Dialog Reload (SKU 0902) has purchase cost Rs 0.9600 and selling price Rs 1.0000 per unit. Its unit is labelled Pieces. Other reload products use either Pieces or Unit.
- The catalogue includes Dialog, Mobitel, Airtel, Hutch, Mega Pay Dialog/Mobitel, CEB, water bills, and insurance products. Some old products are explicitly named “Not Use.”
- Displayed catalogue costs include Dialog/Mobitel Rs 0.96, Hutch Rs 0.94, and Airtel Rs 1.00, against selling prices of Rs 1.00. These are the displayed defaults at inspection time, not universal provider contracts.
- Existing purchase **PO2026/2159** contains 10,000 Dialog Reload units at Rs 0.96, total Rs 9,600, selling price Rs 1.00. It is Received and Paid with a cash payment entry.
- Dialog Reload stock history records this purchase as **+10,000** and sales as negative quantities, including 100, 515, and 999 units. It shows purchase/sale references and a running quantity after each movement.
- The Reloads category currently has category commission **0%**, user share **0%**, and agent share **0%**.

### Interpretation for the replacement

The inspected records support modelling reload balance as face-value units: Rs 500 of reload corresponds to 500 units at Rs 1 selling price. Replenishment is recorded as a purchase at a discounted unit cost; sales consume the available balance. At the inspected Dialog cost, 500 units would have Rs 480 cost and Rs 500 face-value revenue before other adjustments.

This does **not** prove that Clicky POS actually sends reloads to telecom providers. No provider integration, phone-number validation, delivery status, reversal, or provider settlement workflow was verified. The system may simply record a reload performed elsewhere.

Sources: [Product catalogue](https://fidolk.clickypos.com/products), [Dialog product](https://fidolk.clickypos.com/products/view/902), [Dialog stock history](https://fidolk.clickypos.com/products/stock-history/902), [reload purchase](https://fidolk.clickypos.com/purchases/20581).

## Salesperson and agent commissions

### People and account types

- The Users page has filters for Users Only, Commissions Only, Commission Users, and Commission Agents.
- Commission Users include login-enabled staff with Cashier/Admin roles.
- Many Commission Agent records have **Login not allowed**, an agent ID such as `2023/0001`, and an Agents role. Role and commission type are distinct: some agent records show another role.
- The same person can have separate user and agent records; this was visible for a current salesperson. Do not merge these identities solely because names match.
- The user list displays Total Commission, Total Paid, and Total Remaining. Some agent rows have negative remaining balances. The reason and time basis were not established, so these should not be interpreted as errors or current amounts owed without clarification.

### Category configuration

Categories and subcategories display three percentage fields: commission for category, commission for user, and commission for agent.

| Category | Category rate | User share | Agent share |
| --- | ---: | ---: | ---: |
| Smartphones | 1.00% | 20.00% | 80.00% |
| Cases | 4.00% | 25.00% | 75.00% |
| Back Covers | 9.00% | 22.22% | 77.78% |
| Tempered Glasses | 11.00% | 18.18% | 81.82% |
| Battery | 6.00% | 33.33% | 66.67% |
| Repairing Level A | 50.00% | 15.00% | 85.00% |
| Repairing Level B | 10.00% | 40.00% | 60.00% |
| Repairing Parts For Android And Others | 40.00% | 20.00% | 80.00% |
| Reloads | 0.00% | 0.00% | 0.00% |

The Repairing Level A description says “0 Cost 50%.” Subcategories can display their own rates. Category inheritance/override precedence was not tested.

### Reporting and examples

The Sales Representative Report has user, location, date range, commission type, and commission recipient filters. It has Sales Added, Sales With Commission, and Expenses tabs. Sales With Commission lists invoice, customer, location, commission type, sale payment status, sale total/paid/remaining, user commission, agent commission, and total commission.

Observed examples:

- A Rs 1,100 paid sale shows Rs 22 user commission.
- A Rs 1,800 **Due** sale with Rs 0 paid shows Rs 36 user commission.
- A Rs 1,000 paid sale shows Rs 425 agent commission. Its existing invoice contains one **Repairing (Inshop)** line for Rs 1,000.
- Several invoice rows show only a user commission or only an agent commission. Simultaneous attribution to both on a single sale was not verified.

**Likely calculation, requiring confirmation:** eligible line amount × category commission rate × recipient share. For example, Rs 1,000 × 50% × 85% = Rs 425, consistent with the repair sale and Level A configuration; the inspected invoice itself does not identify that product's category. Back Covers' 9% × 22.22% is approximately 2% for the user, consistent with several report examples. Display rounding may hide greater stored precision.

Do not implement the formula as established backend behaviour yet. The inspection did not establish the commission base after discounts/tax/shipping, rounding stage, which category wins, historical rate snapshots, returns handling, or the rules for selecting recipients.

**Accrual versus payout:** unpaid sales already show commission in the report. This proves display/calculation is not restricted to fully paid sales; it does not prove those commissions are payable immediately. A “Genarate Commission” control is present and was disabled in the observed default filter state. It was not activated. Generation, approval, settlement, expense linkage, and payout rules remain unverified.

Sources: [Users](https://fidolk.clickypos.com/users), [Categories](https://fidolk.clickypos.com/taxonomies?type=product), [Sales Representative Report](https://fidolk.clickypos.com/reports/sales-representative-report), [repair invoice](https://fidolk.clickypos.com/sells/20588).

## Purchase invoices and receiving

### Blank Add Purchase form

Observed fields and controls:

- Supplier, reference number, purchase date, business location.
- Purchase status: Received, Pending, Ordered.
- Payment terms in days/months, document attachment, purchase-order selection.
- Product search by name/SKU/barcode, product import, and add-product control. Product search was initially disabled before the required context was chosen; no values were entered to enable it.
- Lines: product, purchase quantity, unit cost before discount, discount percent, unit cost before tax, line total, profit margin, selling price including tax, and lot number.
- Total items, net amount, fixed/percentage document discount, purchase tax, notes, shipping details/cost, and additional expenses.
- Optional payment section with amount, paid-on date, method, payment account, payment note, advance balance, and payment due.
- Methods include Advance, Cash, Card, Cheque, Bank Transfer, Other, and custom payment methods.

No Save, import, add-product, attachment, payment, or other submission control was activated.

### Existing purchases

The list separates **Purchase Status** from **Payment Status** and shows reference, date, location, supplier, grand total, amount due, and added-by user.

- **PO2026/2159:** reload balance purchase; Received and Paid, Rs 9,600. Its stock receipt is visible in Dialog stock history.
- **PO2026/2158:** 16 physical-product lines; Received and Due, total Rs 87,300, with no payments found. Lines include quantities, purchase costs, selling prices, and a lot number. This demonstrates that receiving stock and paying the supplier are separate states.

Purchase detail shows line discounts/taxes, totals, payment entries with their own references/dates/methods, notes, shipping, and activity history with user and timestamp.

**Observed reporting caveats:** the reload purchase's Added activity says payment status Due while its current header is Paid. Also the physical purchase's printable section displays “Cash Tenderd” equal to the full total despite the detail saying Due and no payments found. Use payment records and current status when interpreting these examples; printed labels and an old activity entry are not sufficient payment evidence.

The `PO2026/...` prefix is used on actual purchase records; it alone does not mean a separate purchase order. The navigation has a distinct Purchase Order section, and Add Purchase can link a purchase order.

Sources: [Purchases](https://fidolk.clickypos.com/purchases), [Add Purchase form](https://fidolk.clickypos.com/purchases/create), [reload purchase](https://fidolk.clickypos.com/purchases/20581), [physical purchase](https://fidolk.clickypos.com/purchases/20550).

## Sales and audit information

The sales list separates commission type/amounts from the user who added the sale, and includes payment status, amounts paid/due, location, and shipping-related information. Existing sale details show Final status, item quantities and prices, discounts/tax, packing and shipping charges, rounding, payment references, staff/sale notes, and activity history.

An inspected existing sale activity log includes an SMS notification entry from its original creation. No notification was sent during this inspection. Automatic SMS behaviour is another reason to use a separate test environment for future write-path validation.

Sources: [Sales](https://fidolk.clickypos.com/sells), [existing sale detail](https://fidolk.clickypos.com/sells/20588).

## Decisions to confirm before implementing parity

1. Does the POS execute reloads or only account for provider-side transactions? How are destination phone/account numbers, failures, refunds, and balance reconciliation handled?
2. Are commission shares applied to sales value, profit, or another base, and how do line/document discounts, taxes, shipping, and returns affect them?
3. Can a sale pay both user and agent commissions, or does its commission type select one? Who chooses the agent, and can a salesperson also be an agent?
4. When does a displayed commission become payable? What exactly does Generate Commission create, and how are payments/expenses linked?
5. Are historical commission rates preserved? What precision and rounding rules apply?
6. What stock effects and permissions apply to Pending/Ordered purchases and partial receiving? These were not tested.
7. Which existing labels, balances, and print quirks should be preserved versus corrected in the replacement?

These are targeted follow-up questions, not reasons to modify the live system. Any write-path validation should use a separate test environment or a workflow demonstrated by Fido staff.

## Stock, costing, returns and adjustments

Inspected on 21 October 2026, under the same read-only boundary. Only pages, display filters and existing record views were opened. Nothing was exported, saved or changed.

### Business settings that drive stock and profit

| Setting | Value | What it means |
| --- | --- | --- |
| Stock accounting method | FIFO | Cost of a sale comes from the oldest purchase lots first |
| Allow overselling | Off | The POS should refuse to sell below zero stock |
| Default profit percent | 75% | Suggested selling price on new products/purchases |
| Edit purchase price from purchase screen | On | Receiving stock can change a product's selling price |
| Purchase status / Lot numbers / Purchase orders | On / On / On | Received vs Pending vs Ordered purchases, lot per purchase line |
| Product expiry | Off | No expiry tracking |
| Sub-units, secondary unit | Off | Each product has one unit (Pieces or Unit) |
| Transaction edit days | 60 | Sales and purchases can be edited for 60 days |
| Amount rounding | Nearest 0.5 | Bill totals rounded |
| Commission calculation type | Invoice value | Confirms commission is on sale value, not profit (see questions 2 above) |
| Pay term required, due date on credit sales | On | Credit sales carry a due date |
| Reward points | On, but redeem value Rs 0 | Effectively unused |
| Time zone | Asia/Kolkata | Same UTC offset as Colombo |

### Products and stock

- 2,904 products, all **Single**. There are no Variable or Combo products. Clothing sizes are separate products, e.g. "MARCO POLO Short XL" and "MARCO POLO Short L".
- Stock is held **per business location** (Apple, Trendy, Wow Gifts). A product's stock history must be filtered by location; the default location showed nothing for a Trendy product.
- Stock history shows a summary (purchases, opening stock, sell returns, transfers in; sold, adjustments, purchase returns, transfers out) and a movement list with running quantity and reference.
- Negative stock exists despite overselling being off. The inspected case (MARCO POLO Short XL, −1 at Trendy) comes from an **Opening Stock entry of −1** dated 01/01/2023, not from a sale. Opening stock accepts negative values.
- Brands are sparse (Apple Iphone, Nokia, Oppo, Other, Pocco, Redmi, Samsung); many products have no brand and some have no category.
- Some products are kept but renamed "Inactive" / "Not Use" instead of being deactivated.

### Sell returns

- Prefix CN (e.g. CN2026/0081). Each return is tied to its **parent sale**, lists return quantity per line at the original unit price, with an optional return discount and tax, and its own refund payment.
- 72 returns in total; 9 in the current financial year, nearly all at Apple By Fido.
- Returns can be dated earlier than when they were entered (a return dated 15 Oct was added on 16 Oct).
- Returned quantities appear as "Total Sell Return" in stock history, i.e. they go back into stock. No choice between restock, supplier return or waste was visible.

### Purchase returns

- 34 in total, none this financial year. Each is tied to a parent purchase and has its own payment status.

### Stock transfers

- None ever recorded, although three locations exist. Stock is not moved between shops in the system.

### Stock adjustments

- 25 adjustments since 2023, prefix SA, almost all at Apple By Fido. Every one is type **Normal**; adjustments only remove stock.
- Each has a total value and a "total amount recovered". In most rows recovered equals total, so the write-off shows no loss.
- The reasons show adjustments being used as a catch-all for things the system has no proper flow for:
  - **Price drops** ("Price reduce", "Price Droped", up to Rs 126,000) — writing stock off to re-cost it, because FIFO lots cannot be revalued.
  - **Family / personal use** — items taken by relatives.
  - **Seller returned**, **Wrong color** — goods sent back to a supplier without a purchase return.
  - Large unexplained adjustments (Rs 250k–390k) with no reason.

### Error handling

Opening a sell return by the wrong id returned a full Laravel stack trace with server file paths. Debug mode appears to be on in production. This is a security issue for the old system's operator, not something the replacement should copy.

### Comparison with the replacement

| Area | Old system | Replacement today | Suggestion |
| --- | --- | --- | --- |
| Costing | FIFO from purchase lots | Lots (`Batch`) with remaining quantity and unit cost; profit uses lot cost | Keep. Already matches |
| Stock location | Per shop location | Per product, with a `department` (Phones/Clothing/Gifts) | Confirm whether the three shops ever share stock; if not, department is enough |
| Sizes/variants | Separate products per size | Separate products | Fine for now; a size/colour group would tidy Clothing |
| Opening stock | Can be negative | — | Never allow negative opening stock on import |
| Sell returns | Linked to sale, always restock | Linked to sale, disposition Restock / Supplier return / Waste, commission reversed | Replacement is already better |
| Supplier returns | Purchase return, rarely used; adjustments used instead | `SupplierReturn` | Make it quick enough that staff don't fall back to write-offs |
| Adjustments | One type, free-text reason, "recovered" hides losses | Typed movements: Count adjustment, Damage, Loss, Repair use | Add **Own use** and **Price drop / revalue** so these stop being disguised write-offs |
| Price drops | Write off and re-add | — | Add a revalue action that changes remaining lot cost and records the loss |
| Stock counts | None | `InventoryCount` with draft → approve | Replacement is already better |
| Transfers | Never used | — | Not needed unless shops start sharing stock |

### Migration notes

- Bring products across as Single products with category, brand, cost, price, SKU and per-location stock.
- Clamp or flag negative stock rather than importing it.
- Skip products named "Inactive"/"Not Use", or import them inactive.
- Opening lots: one lot per product at the current unit purchase price is the practical choice; full FIFO lot history would need a database export.
