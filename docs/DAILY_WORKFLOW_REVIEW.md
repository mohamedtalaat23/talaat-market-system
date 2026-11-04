# Daily-workflow review — November 4, 2026

This phase exercises the existing single-store Linux browser/API/PostgreSQL workflows and prepares Windows pilot handoff. It does not certify native Windows, retail hardware or fiscal compliance. All fixtures and migrations used disposable loopback test databases. Existing business databases and the user's root edits were preserved. No changes were pushed.

## Delivered fixes

- Independent fixtures for each journey and language, with separate admin/manager/cashier/next-cashier accounts, register, product, customer, supplier and draft order. Browser actions use real services; mocks remain only for controlled layout/failure tests.
- Repeated product search selects the current result with Enter and hides stale results while the new query settles. Results are keyboard-accessible buttons. The global scanner handler leaves dialog inputs alone.
- Refund and drawer requests now include their required manager PIN. Refund search hands focus to the return workspace; closing shifts and receiving/payment dialogs have modal semantics and contained focus.
- High-discount authorization occurs at payment with the final discount and payable amount visible. The request carries the manager credentials transiently; PINs are never added to the durable offline payload.
- Customer payment retries reuse their original intent key; successful acknowledgement clears it before a new payment, including another payment of the same amount. Failed submissions retain entered data. Receipt retries have the same intent lifecycle.
- Partial receiving now has server-backed idempotency. Concurrent/lost-response retries post one receipt and stock movement; changed payloads cannot reuse a key. Legacy callers without a key retain their existing contract.
- Successful authentication no longer consumes the failed-login budget, preventing busy-store lockout. A regression sends 40 valid requests, then proves the 31st failed attempt is still blocked.
- The cashier lock screen no longer requests an unauthorized full staff directory. Cashiers can unlock their own profile; authorized managers/admins retain staff selection.
- Refund previews show the allocated net refund amounts, including discounted partial returns, and translate the refund tender label. Removed placeholder contact data and corrected receipt identifiers. The receipt and shift-close surfaces scroll within the viewport.
- Cairo, Inter and JetBrains Mono font weights are bundled with their upstream SIL licenses. The app makes no Google Fonts requests at runtime.

## Compatibility and migration

Deploy server and client together after applying additive migration **038_purchase_receipt_idempotency**. It adds nullable, uniquely indexed `idempotency_key` and `request_fingerprint` columns to `purchase_order_receipts`; existing records remain intact.

`POST /purchases/:id/receive` accepts an optional `idempotency_key` (1–100 trimmed characters). New clients preserve it for an unchanged failed submission and start a fresh intent after acknowledgement. Replays compare the order, receiver and normalized items/notes before returning success. No other public API changes were needed.

## Acceptance evidence

The suite covers checkout with a committed-but-lost response, quantity changes, approved discounts/invalid PIN, suspended-cart resume, discounted partial returns, separate restock/write-off, UI purchase creation and partial/final receiving, credit sale and partial customer payments, drawer movement and cashier handover, offline approval/rejection/reconciliation, and owner setup/backup/diagnostics with internet blocked.

New browser cases assert persisted money, stock, sale/refund records, balances, shift ownership and queue acknowledgements. Each real workflow runs in English and Arabic. Reference screenshots use 1366×768 and 1920×1080, with finite animations disabled for stable captures. See [daily screenshots](qa/daily/README.md). Failed-run traces are retained by Playwright under the ignored `packages/client/test-results` directory.

| Check | Result |
| --- | --- |
| Full browser acceptance | **18 passed**, 1.6 minutes; every planned journey in both languages |
| Final long-name/populated-cart visual checks | **4 passed**, 27.4 seconds; both languages and resolutions |
| Client unit tests | **42 passed** |
| Server unit tests | **309 passed**, including failed-authentication budget protection |
| PostgreSQL integration | **59 passed**, including receipt retry concurrency and backup/restore into a fresh empty target |
| Desktop unit tests | **49 passed** |
| Typecheck / lint | **Passed**, zero lint warnings |
| Server/client production builds | **Passed** |
| Desktop compilation | **Passed** |
| Windows / physical devices / fiscal acceptance | **Not tested**; remains a separate gate |

The final run also corrected an acceptance-fixture lifecycle issue: file-level teardown had destroyed the shared Knex pool before the next file. Database cleanup now runs once at the worker boundary. Fault injection waits for the actual failed network request before allowing a retry, avoiding false passes from a button that was still enabled before submission.

## Reproduction

Use Node 24+, PostgreSQL 16 and Playwright Chromium. Provision a fresh disposable cluster bound to loopback and create a database ending `_test`. Set these explicitly before running anything:

```bash
export NODE_ENV=test TALAAT_E2E=1
export DB_HOST=127.0.0.1 DB_PORT=55439
export DB_NAME=talaat_daily_test DB_USER=daily_test
export DB_PASSWORD='<test-only password>'
export SESSION_SECRET='<random test secret of at least 32 characters>'
export JWT_SECRET='<different random test secret of at least 32 characters>'
export BACKUP_DIR=/tmp/talaat-daily-backups LOG_DIR=/tmp/talaat-daily-logs
export E2E_CLIENT_PORT=5188
npm run db:migrate
npm run test:e2e --workspace=packages/client
npm run test:server:integration
```

For the full restore tests, provision and migrate a **second empty** database, then set `RESTORE_TEST_DATABASE` to its name before running integration tests. A populated restore target is deliberately refused. Do not run development seeds against existing data. The browser configuration refuses non-loopback or non-`_test` targets and does not reuse running servers. It needs API port 55441 and the selected frontend port available.

```bash
npm run typecheck
npm run lint
npm run test:client
npm run test:server:unit
npm run test:desktop
npm run build:server
npm run build:client
npm run compile --workspace=packages/desktop
```

## Windows pilot handoff

Still **not tested here**: Windows installer/upgrade/data preservation and legacy authentication transition; native Electron lifecycle/security; physical scanners, printers, Arabic paper output and cash drawers; actual power loss/disk-full; sustained multi-register network partitions; and fiscal/accounting applicability. Follow `RELEASE_CHECKLIST.md` on the target Windows machine and record hardware models and evidence. Technician-assisted restore and a protected off-device backup copy remain required operational procedures.
