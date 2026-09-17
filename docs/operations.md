# Deployment and recovery checklist

## Current status

The test Neon database schema is initialized and empty. No production domain, text.lk token, approved sender ID, job scheduler or production backup secrets have been provisioned. The first live owner account must be created in the browser with the one-time setup key.

## Before live use

1. Create separate production and test Neon projects. Use a least-privileged role, `sslmode=verify-full`, the host secret manager and Neon recovery features appropriate to the chosen plan.
2. Set independent random values for `APP_ACCESS_KEY`, `APP_ENCRYPTION_KEY`, `CRON_SECRET` and `BACKUP_ENCRYPTION_KEY`. Keep the backup key outside the database, deployment host and GitHub.
3. Run `npm run vapid:generate`, store the three VAPID values in the host secret manager, configure a once-per-minute scheduler for `/api/jobs`, add the approved text.lk sender/token in Settings, and verify actual push, SMS and retry behavior.
4. Add GitHub repository secrets `DATABASE_URL` and `BACKUP_ENCRYPTION_KEY`, run the backup workflow manually, download and decrypt its artifact, and restore it into a separate recovery database.
5. Import validated CSV exports through Settings. The import is atomic, but the owner must still reconcile batch/IMEI stock, cash, bank, provider wallets, customer balances, suppliers, cheques and COD before accepting opening balances.
6. Confirm the profit-based sales commission split, repair share, provider recognition rules and COD accounting with the owner using real examples.
7. Link each staff login to its staff record. Test commission attribution, the 80 mm printer, scanner, phone layouts, background notification permission, bus-arrival escalation and duplicate submissions on shop devices.
8. Perform owner acceptance before cutover and keep the old system read-only for reconciliation.
9. Run `npm run production:check`; deployment is blocked until it passes. Configure the platform readiness probe to call `/api/health` and alert after repeated failures.
10. Review the Authentication activity table regularly. Investigate repeated failures, unexpected owner changes and disabled accounts. An administrator access change revokes that account’s sessions.

## Backup and restore

`npm run backup` runs `pg_dump`, creates a custom-format dump in a private temporary directory, encrypts it with AES-256-GCM, writes it to `BACKUP_DIR`, and deletes the plaintext copy. The daily GitHub workflow verifies decryption and the PostgreSQL archive catalog before uploading only the encrypted file as a private artifact with 30-day retention.

Run `npx tsx scripts/decrypt-backup.ts input.dump.enc recovered.dump` with `BACKUP_ENCRYPTION_KEY` available in the environment. It refuses to overwrite an existing file. Restore the decrypted dump with `pg_restore` into an isolated database, verify it, then securely remove the plaintext dump.

A restore check should cover users, workspace records, idempotency requests, balanced journal totals, invoices and payments, receivables/payables, stock quantities, IMEIs, encrypted repair credentials, queued SMS and alerts. Browser sessions can be revoked after recovery.

## Authentication operations

The first owner is created once with `APP_ACCESS_KEY`. Passwords use salted scrypt hashes. Sessions last 12 hours, are stored as hashes and use an HTTP-only strict cookie. Five failed attempts lock an account key for 15 minutes; the client limiter allows more failures to avoid trivial account-lockout denial of service while still slowing distributed guessing.

Every user can change their password from the profile button. The current browser remains signed in and other sessions are revoked. Owner and permission changes are restricted so a manager cannot grant access they do not possess, and the final active owner cannot be disabled or demoted. Authentication events are retained for one year by the scheduled maintenance worker.

## Budget

The target recurring ceiling is LKR 6,000 per month. Hosting, database, scheduler, SMS and any longer backup retention should be priced together before paid services are enabled. Trans Express remains outside the initial release until its API contract and operating cost are approved.
