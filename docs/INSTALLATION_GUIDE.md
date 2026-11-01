# Installation, backup and recovery guide

**Candidate status: NOT READY for customer deployment.** No accepted Windows
installer is included. This guide separates owner actions from technician work;
follow [RELEASE_CHECKLIST](RELEASE_CHECKLIST.md) before a pilot or paid install.

## For the supermarket owner

1. Have a named technician install an accepted, signed package on the designated
   Windows account. Do not use a development seed or passwords copied from a demo.
2. The first launch shows a unique administrator password once. Store it safely,
   sign in and change it immediately. Create named staff accounts with only the
   roles they need. Managers must finish password rotation before approving sales.
3. Configure store name/address/phone, language, receipt information and the
   correct register. Have the fiscal adviser confirm the tax/receipt setup before
   recording real trade. This candidate is not a certified fiscal register.
4. Select a real printer and run a physical receipt test. A preview or Windows
   spooler success does not prove that paper printed. Mock mode must never be used
   as proof of production printing.
5. Open a shift with counted starting cash. At closing, count actual cash and
   investigate any discrepancy. Returns after an earlier shift closes are paid
   from the operator's current open drawer.
6. If a sale fails or the connection drops, keep the cart and retry. Do not start
   another sale for the same customer merely because a receipt did not print.
   Managers review held offline sales from the dashboard. Rejected offline sales
   need reconciliation of the physical money/goods; do not delete their evidence.
7. Before opening each trading day, verify the correct register, a healthy
   connection, printer, and adequate disk space. Keep a protected off-machine
   backup and the support contact accessible when the till is unavailable.

## Owner backup procedure

1. Sign in as administrator and open Settings → General → Full Database Backup.
2. Wait for the success response and note the exact file name. Confirm the file
   exists in the configured backup folder; a toast alone is not an off-device copy.
3. Copy the backup to separately protected storage. A copy on the same disk will
   not survive disk failure. The JSON contains financial/personal data and normally
   credential hashes: restrict access and use protected/encrypted storage.
4. Agree a frequency and recovery target with the technician; keep multiple dated
   copies. This candidate has no accepted automatic off-device backup routine.
5. Rehearse restoration with the technician on a separate database. Never test a
   restore over the trading database.

If a backup fails, keep the earlier copies and contact support. Do not manually
edit a backup, ignore checksum errors or replace the database directory.

## Owner failure and recovery procedure

- **Printer failure:** check paper, power and Windows queue. Keep the sale/receipt
  number. Reprint the existing receipt after checking whether paper already came
  out; printing failure does not cancel the sale.
- **App startup failure:** retain the message and logs, stop repeated attempts,
  and call the technician. Do not delete `postgres-data`, `config.env` or backups.
- **Lost administrator password:** use the technician's local recovery procedure.
  There is no universal password or remote password reset in this product.
- **Database/storage failure:** stop trading in the affected installation and
  preserve the data directory and backup media. Recovery and promotion require a
  technician; do not run arbitrary SQL or demo reset scripts.

## Technician: reproducible build

Target: one supermarket, Windows x64, local PostgreSQL, normal Windows user.
Use Node 24 and the committed `package-lock.json`. Keep signing secrets outside
source control. Never package `.env`, private customer config, database data or
operator recovery credentials.

1. Obtain the chosen supported PostgreSQL x64 distribution from a trusted source;
   verify provenance/hash, compatibility, required extensions/DLLs and license
   notices. Place its contents under `vendor/postgres/win-x64/`. The repository
   currently contains only a README, so installer preflight intentionally fails.
2. Run the engineering checks in [RELEASE_CHECKLIST](RELEASE_CHECKLIST.md).
3. Run `npm run build:win` on Windows. It compiles the server/client, compiles and
   bundles the desktop preload, stages locked server/desktop production dependencies,
   checks forbidden development/client packages, then invokes builder with
   `--publish never`. Do not replace staging with the root `node_modules`.
4. Inspect the built archive/resources, its `runtime-inventory.json`, actual Electron
   version and all dependency/license notices. The inventory describes staged
   npm packages; actual artifact verification must also account for Electron,
   bundled PostgreSQL, DLLs and builder-collected desktop dependencies.
5. Sign and verify the designated candidate on the controlled Windows build host.
   Record version, source commit, artifact SHA-256, runtime versions and test
   evidence. Signing/installation must not be inferred from a successful compile.
6. Run clean install and upgrade acceptance on disposable Windows machines before
   customer installation. No publish/push/deployment was performed in this mission.

## Data layout and access

The authoritative base is Electron `app.getPath('userData')`; confirm its actual
Windows path in acceptance (historically expected under `%APPDATA%\Talaat Market`).
Do not guess a path and initialize a replacement database if the expected one is
missing.

| Under userData | Purpose |
| --- | --- |
| `config.env` | private DB credentials, superuser recovery secret and session keys |
| `postgres-data/` | existing PostgreSQL cluster; never replace during app update |
| `postgres.log`, `logs/` | local diagnostics; protect/export with personal data redacted |
| `backups/` | confidential logical backup files, not off-device protection |
| `config.json` / electron-store | printer configuration, print-job and offline-sale queues |
| `recovery-<id>-<uuid>.txt` | per-employee local reset credentials, delete after successful handover/change |

POSIX mode 0600 is requested for secrets, but it is not a Windows ACL guarantee.
Acceptance must prove unrelated users cannot read configuration, recovery files,
queues, backups or database files. Do not add broad antivirus exclusions.

## Clean first run

The managed cluster is initialized with SCRAM authentication and a generated
administrator secret, persisted before initialization. The transient initdb
password file is removed. The app database role is not a PostgreSQL superuser.
PostgreSQL listens on loopback and a free local port recorded in the config.
Startup applies migrations then bootstraps the administrator. Provisioning is
retryable after a partial app-role/database creation failure.

Required tests: wrong/no password denied, first-run password change, normal-user
permissions, repeated start, interrupted setup, port conflict, failed migration,
disk-full and clean shutdown. These have not all been run on Windows.

## Existing installation: supervised authentication upgrade

An older cluster using passwordless HBA rules, or missing
`PG_SUPERUSER_PASSWORD`, now stops before normal startup. The application does
not drop, reinitialize, silently convert or forcibly crash that cluster.

A qualified technician must rehearse the following on a disposable copy first:

1. Stop register activity, identify the exact existing data/config locations and
   PostgreSQL version, and make verified backup/recovery copies before changes.
2. Use an isolated maintenance session on the existing cluster, restricted to the
   local machine and trusted OS account. Do not expose a legacy trust-based server
   to a network or untrusted local users.
3. Set a unique administrator password using the interactive `psql \password`
   command (avoid passwords in command-line arguments/history). Securely record
   the matching `PG_SUPERUSER_PASSWORD` in the private managed configuration.
   Preserve the existing application role/password and database.
4. Review every active `pg_hba.conf` rule and any included files. Replace applicable
   passwordless access with SCRAM, reload, and prove both valid-password access
   and wrong/no-password refusal. Confirm required roles have compatible stored
   password verifiers before changing the rules.
5. Stop PostgreSQL gracefully, start the new app, verify existing accounts,
   balances, stock and pending queues, then run upgrade acceptance. Never delete
   `postmaster.pid` as a substitute for identifying a running process.

This is a technician procedure and release gate, not a tested automated customer
upgrade. Stop and recover the saved installation if any assumption is false.

## Application account recovery

From the source/support runtime with the correct private config selected:

```sh
npm run security:audit-credentials
npm run admin:rotate -- --username <employee-name>
# Add --pin <new-nontrivial-pin> only when intentionally provisioning a new PIN.
```

The command persists a separate private recovery file **before** changing each
account, clears the old PIN unless replaced, revokes old sessions and forces a
password change. `--all --dry-run` previews bulk recovery; `--all` makes one file
per employee. Never send these files to a public issue or include them in logs.
The old claim that every reset overwrites `initial-admin-credentials.txt` is
superseded. A packaged support tool/owner-facing reset flow still needs Windows
acceptance; a customer should not install development tools to recover a till.

## Restore and rollback (technician only)

See [UPGRADE_AND_RECOVERY](UPGRADE_AND_RECOVERY.md) for validation/apply commands.
Create a separate target and migrate it using the **same build mode and migration
filenames** as the backup source. Production `.js` histories and development
`.ts` histories are not interchangeable. Never edit migration history to bypass
schema verification.

Restore validation checks checksum, migration set, references, required tables,
and an empty/migration-default-only target. Apply is transactional and verifies
counts before commit. A credential-free restore locks staff until local recovery.
The backup service does not promote a restored database automatically.

For promotion: stop trading and all app/database clients, verify the separate
restore, retain the old database and config, perform a supervised offline swap,
verify totals/account access/printing, and only then resume. Keep the accepted
previous installer and backup with the release record. App binary rollback does
not justify destructive schema rollback; never run `db:rollback` against business
data without a separately reviewed recovery plan and explicit approval.

## Hardware authorization setup (P0-2)

See [HARDWARE_IPC_SECURITY](HARDWARE_IPC_SECURITY.md). Deploy matching desktop
and backend versions. Standalone uses the local authenticated backend. For LAN,
a technician must configure `HARDWARE_AUTHORITY_URL="https://host:port"` in the
private userData `config.env`, with the actual server certificate trusted by the
OS. Never disable TLS verification or let renderer LAN settings select the
hardware identity authority. After restart, sign in and verify connectivity
before going offline; cold offline authority is deliberately denied. Offline
leases last at most 15 minutes/JWT expiry and 100 mutating admissions/dispatches.
Administrative operations and manual drawer/reprints require an online authority.
There are no implicit cash-receipt drawer pulses; explicitly authorize drawer
opening. Preserve the audit and receipt-claim files, and test ownership/ACLs.
