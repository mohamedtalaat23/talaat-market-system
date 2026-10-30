> Current release decision: **NOT READY**. See [INSTALLATION_GUIDE](INSTALLATION_GUIDE.md)
> for owner/technician procedures and legacy PostgreSQL authentication upgrade.
> Credential recovery now writes **separate `recovery-<id>-<uuid>.txt` files before
> modifying accounts**, clears the old PIN unless replaced, and never overwrites
> another employee's output. Historical descriptions of one shared reset file
> below are superseded. Migration 036 adds nullable refund retry keys and a unique
> constraint; the refund API now requires a key. Apply it with the same build mode
> as the installation, after taking a backup.

# Upgrade, credential rotation and recovery runbook

_For the administrator installing an update or recovering a compromised
installation. Read fully before running anything against a live database._

## 1. What migration 035 changes

`packages/server/migrations/035_credential_rotation_and_payment_integrity.ts`

| Change | Backward compatibility |
| --- | --- |
| `employees.credential_rotation_required` (default `false`) | existing accounts keep working unless a published default credential is detected |
| `employees.auth_epoch` (default `0`) | JWTs issued before this migration carry no `ae` claim and are treated as `0`, so **no one is signed out by the upgrade itself** |
| `employees.password_changed_at` (nullable) | informational only |
| `customer_transactions.idempotency_key` + partial unique index | nullable; existing rows unaffected |
| `offline_sync_quarantine` table | new |

Rollback (`npm run db:rollback`) drops the new table, the index, the columns and
their data. **Rolling back after the scan has run re-enables every account that
was locked**, and rolling back discards quarantine records; take a backup first.
Rows are never deleted or rewritten by the migration itself.

## 2. Existing installations: published default credentials

Installations provisioned before this release may still hold the credentials
published in this repository (`admin`/`admin123`, `manager123`, `cashier123`,
PIN `1111`, …). A `DEFAULT false` column does not protect them, so three
independent controls now apply:

1. **Startup scan** (`database/credential-hygiene.ts`): on the first start after
   the upgrade, stored hashes are compared against the published defaults. Every
   match is flagged: `credential_rotation_required = true`,
   `must_change_password = true`, `auth_epoch` incremented (kills all existing
   tokens for that account). The scan runs once per installation (marker in
   `settings.security_credential_hygiene`) and is bounded so it cannot stall a
   large staff table.
2. **Login-time block** (`services/auth.service.ts`): submitting a published
   default password or a trivially guessable PIN flags the account and returns
   `403 CREDENTIAL_RESET_REQUIRED` instead of a token. There is no window in which
   the default credential grants access.
3. **Provisioning policy**: creating/updating an employee now requires a
   12+ character, non-placeholder password and a non-trivial PIN
   (`validators/employee.validator.ts`), so new accounts cannot reintroduce a
   default.

### Recovery (required once per flagged account)

Flagged accounts cannot rotate their own password — whoever knows the default
would otherwise simply change it. Recovery is a **local, operator-run** command:

```bash
# one account
npm run admin:rotate -- --username admin

# optional: also set a new PIN (4–6 digits, not repeated/sequential)
npm run admin:rotate -- --username manager --pin 482913

# every flagged account at once (mass recovery)
npm run admin:rotate -- --all

# see what would change without touching the database
npm run admin:rotate -- --all --dry-run
```

The command generates a strong password, clears the lock, bumps the auth epoch
(all existing sessions die) and writes the credential to
`initial-admin-credentials.txt` (mode 0600) next to the managed config file. The
secret is never printed to stdout or written to logs. The employee must still
choose their own password at first login (`must_change_password`).

To inspect the state without changing anything:

```bash
npm run security:audit-credentials             # report only
npm run security:audit-credentials -- --apply  # lock the accounts (same as startup)
```

### Session behaviour

* Rotating a credential (self-service change or operator rotation) increments
  `auth_epoch`; every token minted before the rotation is rejected on its next
  request (`401 Your session has expired`).
* `POST /auth/change-password` returns a **new token** for the session that
  performed the rotation, so a legitimate user is not logged out of the tab they
  are using while all other devices are.
* A flagged account receives `403 CREDENTIAL_RESET_REQUIRED` on any endpoint,
  including `/auth/me`.

## 3. Backups

A backup is a complete logical export of every application table, in
foreign-key-safe order, with a checksum:

```bash
# from the app: Settings → Full Database Backup (admin only)
# or via API:  POST /api/v1/settings/backups   { "include_credentials": true }
```

* Written to `BACKUP_DIR` with mode `0600`.
* Contains sales, sale items, shifts, customers, ledger, employees, purchases,
  refunds, inventory, batches, cycle counts, settings and audit logs.
* Contains credential hashes by default (a restore without them cannot
  authenticate anyone). Treat the file as confidential; it is never logged.
* `"include_credentials": false` produces a safer-to-share file; restoring it
  locks every employee (`credential_rotation_required = true`) until
  `npm run admin:rotate -- --all` is run.

## 4. Restore (never into the live database)

```bash
# 1. create an empty database and bring it to the current schema
createdb talaat_market_restore
DB_NAME=talaat_market_restore npm run db:migrate

# 2. validate only (default): checksum, schema match, FK integrity, empty target
npm run db:restore -- --file talaat-market-full-....json --target talaat_market_restore

# 3. apply into the separate database
npm run db:restore -- --file talaat-market-full-....json --target talaat_market_restore --apply
```

Validation refuses to continue when: the checksum does not match, the file was
taken on a different migration set, a row references a parent missing from the
file, the target contains business data or modified defaults, or the target is the live database.
The unchanged default register, reason codes and aging settings created by migrations
are accepted and replaced inside the restore transaction.
The restore runs in one transaction (all-or-nothing), resynchronises sequences,
then verifies per-table row counts.

**Promotion is manual**: stop the server, rename/swap the databases
(`ALTER DATABASE ... RENAME TO ...`), verify a login and a receipt print, then
start the server. Nothing in the application re-points itself automatically.

## 5. Staging verification checklist

1. `npm run db:migrate` on a copy of production data; confirm 035 applies.
2. Start the server; check the log for the credential hygiene summary
   (accounts flagged, or "none detected").
3. Log in as a non-flagged user: success. Log in with `admin123` (if that account
   still exists): expect `CREDENTIAL_RESET_REQUIRED`, no token.
4. `npm run admin:rotate -- --username <flagged>` → log in with the new password,
   confirm the forced change screen, change it, confirm other sessions are
   rejected.
5. Ring up a sale: cash with change, card, split (cash+card), and a credit sale to
   a customer. Verify `cash_paid + card_paid + debt_paid === total` in `sales`.
6. Attempt a split payment whose card portion exceeds the total → rejected.
7. Refund one unit of a three-unit line twice, then the last one; confirm the
   refunds add up to the line total exactly and cash/card refunds match the
   original tender split.
8. Record a customer payment: exact balance → accepted; 0.01 more → 409; repeat
   the same request with the same idempotency key → `duplicate: true`, one ledger
   row.
9. Close the shift and compare `expected_cash` with the drawer count; confirm the
   summary matches the sales plus cash payments minus cash refunds.
10. Create a backup; validate a restore into `talaat_market_restore`; compare row
    counts; confirm the live database was untouched.
11. Take an offline sale at the catalogue price → syncs. Modify the payload price
    downwards → lands in `offline_sync_quarantine` and is not posted. Approve it
    with a manager PIN → posted once.


### Automated recovery regression

Provision a **disposable** source database and a separate **disposable**, freshly
migrated target. Set `DB_NAME` to that source and `RESTORE_TEST_DATABASE` to that
target before running `npm run test:server:integration`. The opt-in recovery test
writes fixture data to the source and **truncates the target between restores**.
Never point either variable at an installation containing real business data.
Without `RESTORE_TEST_DATABASE`, the recovery suite is skipped. CI provisions
both databases automatically in `.github/workflows/verify.yml`.

Development migrations record `.ts` filenames; compiled production migrations
record `.js` filenames. For recovery, migrate the target with the same mode/build
used by the source. A matching schema with different migration filenames is
currently rejected; do not edit migration history to bypass validation.
