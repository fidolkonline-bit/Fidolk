# Fido LK

Fido LK is a Next.js business workspace for one Sri Lankan shop operating Phones, Clothing and Gifts. It uses PostgreSQL/Neon as the single source of truth and stores all money as integer LKR cents.

## Included workflows

- Race-safe owner bootstrap, staff accounts, salted scrypt passwords, database sessions, account/client login throttling and granular permissions enforced by the server.
- POS, 80 mm receipts, cash/card/bank/credit payments, partial collections, partial returns, exchanges/store credit, FIFO cost and profit-based commissions.
- Purchase orders with partial receipts, GRNs, batches/lots, IMEI stock, suppliers, supplier credit, purchase discounts, cheques, supplier returns and settlement.
- Repair intake, accessories checklist, encrypted PIN/pattern storage, customer approval, multiple spare parts, warranty claims and completion commission.
- SL Post/manual courier tracking, delivered COD receivables and multi-shipment settlement with fees and differences.
- Provider wallets and configurable top-up/transaction commission rules for reloads and bill payments.
- Expenses, salary advances, simple monthly payroll, double-entry journal, reports and outstanding receivables/payables.
- Scheduled bus-arrival alerts, acknowledgement/escalation, background Web Push, owner escalation SMS, customer credit reminders and a text.lk retry worker.
- Atomic CSV import for products, customers and opening stock, with validation and rollback on any invalid row.
- Encrypted PostgreSQL backups with a daily GitHub Actions workflow.
- Authentication audit history, self-service password changes, session revocation, security headers, a database readiness endpoint and a non-root production container.
- Gemini-powered daily briefs, repair guidance, customer-message drafts, invoice image extraction, inventory insights, privacy-safe business Q&A, anomaly explanations and marketing copy. AI is advisory and cannot post financial or stock actions.

## Local setup

Requires Node.js 20.9+.

```sh
npm install
cp .env.example .env.local
npm run db:setup
npm run dev
```

Set `DATABASE_URL`, a long random `APP_ACCESS_KEY`, a separate 32-byte base64 `APP_ENCRYPTION_KEY`, and `CRON_SECRET`. Generate Web Push keys with `npm run vapid:generate`, then set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`. On first open, create the owner account using `APP_ACCESS_KEY`. The key only authorizes this one-time bootstrap.

Before deployment, run `npm run production:check`. It refuses to pass when required secrets, verified database TLS, tests, type checking or the production build are incomplete. `GET /api/health` is the readiness endpoint for the hosting platform. It returns success only when PostgreSQL and the main workspace are available.

During local development only, omitting `DATABASE_URL` enables labelled demo mode and stores fictitious data in `.data/demo.json`. Production fails closed when the database is missing, because serverless filesystems cannot safely persist business data.

## Scheduled processing

Call `GET` or `POST /api/jobs` with `Authorization: Bearer <CRON_SECRET>` once per minute. The worker advances due arrival alerts, escalates unacknowledged alerts, sends Web Push events, queues due customer credit reminders, and sends up to ten queued messages through text.lk. The owner configures the text.lk sender ID and API token in Settings; the token is encrypted before storage. Staff must enable background push once from the Alerts page on each browser.

## AI assistant

Configure Gemini under **Settings → AI & automation**. The API key is encrypted with `APP_ENCRYPTION_KEY`, is never returned to the browser, and can be replaced without redeploying the application. Configure a primary and fallback Gemini model, daily request ceiling and individual feature switches. The connection test and every generation call run only on the server.

Fido sends only the minimum context for each feature. Customer names, phone numbers, addresses, IMEIs and repair credentials are excluded from generated business summaries; common sensitive patterns in operator text are redacted. Do not paste credentials or unnecessary personal information into AI forms. Invoice and generated operational content always require human review. AI never creates sales, posts stock, changes accounting, approves credit, sends a message or changes access permissions.

Free Gemini tiers may process submitted content under different data-use terms than paid tiers. Review the current provider terms before enabling AI with live business information.

## Data import

Settings accepts UTF-8 CSV files up to 2 MB. Imports run as one transaction, so an invalid row leaves the database unchanged. Supported headers are:

- Products: `sku,name,category,department,price,cost,reorderLevel,serialized`
- Customers: `name,phone,address`
- Opening stock: `sku,supplier,lot,quantity,unitCost,paid,imeis`

Review the imported records and reconcile every opening balance before live sales begin.

The old system’s product export is detected automatically and can also be selected as **Current system products + opening stock**. It maps Product, SKU, Category, purchase price, selling price and current stock; preserves leading-zero SKUs and inactive status; skips malformed export-footer rows; and records stock as opening inventory equity. For a reviewed command-line migration, run a dry-run first and add `--commit` only after checking its totals:

```sh
npm run import:legacy-products -- /path/to/products.csv
npm run import:legacy-products -- /path/to/products.csv --commit
```

## Backups

Generate a separate 32-byte base64 `BACKUP_ENCRYPTION_KEY`, then run:

```sh
npm run backup
```

The daily GitHub workflow uses repository secrets named `DATABASE_URL` and `BACKUP_ENCRYPTION_KEY`, creates an encrypted custom-format PostgreSQL dump, decrypts it temporarily to verify the authenticated encryption and PostgreSQL archive structure, and retains only the encrypted artifact for 30 days. Keep another copy of the encryption key outside GitHub and the database. Test full restores regularly with `scripts/decrypt-backup.ts` and `pg_restore`.

## Production container

The included `Dockerfile` builds Next.js standalone output and runs as an unprivileged user. Supply secrets at runtime rather than during the image build. Terminate TLS at the hosting platform, point its health check to `/api/health`, and run one application instance initially; PostgreSQL transactions serialize financial changes safely if the service later scales horizontally.

## Checks

```sh
npm test
npm run typecheck
npm run build
npm run production:check
```

The tests cover FIFO stock, IMEI validation, profit-based commission, credit restrictions, repair approvals, encrypted credential deletion, cheque clearance, COD accounting, payroll duplication, partial/full returns, balanced journal entries, transaction rollback and idempotency.

## Deployment notes

- Serve over HTTPS, use `sslmode=verify-full` for PostgreSQL and configure the scheduler for `/api/jobs`.
- Review authentication activity in Team & payroll. Password changes revoke every other session, and changing another account’s access revokes all of that account’s sessions.
- Use a least-privileged production database role and Neon recovery features in addition to encrypted dumps.
- Import existing CSV exports only after mapping and reconciling opening stock, customer balances, supplier balances and cheque status.
- Confirm the commission policy, reload provider rates and accounting recognition rules with the owner before accepting live opening balances.
- Link each login to its staff record so sales, repairs, commissions and payroll are attributed to the correct person.
- Test the barcode scanner, 80 mm receipt printer, background notifications and approved text.lk sender on the shop laptop and phones.
- Trans Express remains a future integration; current courier records support SL Post and manual tracking.
