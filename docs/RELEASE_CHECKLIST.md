# Release acceptance checklist

Do not release while a P0 gate is open. Record release version/commit, Windows
version, PostgreSQL version, printer model, verifier, date, evidence and outcome
for every device/environment item. No checkbox implies evidence not recorded.

## Engineering gates

- [x] Re-establish lint, TypeScript, server/client/desktop test baselines.
- [x] Exercise real browser login, manager authorization, register open, product search, checkout, interruption and retry.
- [x] Test duplicate/concurrent checkout, competing stock requests and customer repayments on disposable PostgreSQL.
- [x] Test discounted/duplicate/idempotent refunds, closed-sale/current-drawer payouts and competing quarantine approvals.
- [x] Test transaction disconnection rollback and corrupted backup refusal.
- [x] Test clean migrations and upgrade from 035 to 036 with synthetic records preserved.
- [x] Test complete restore with/without credential hashes and concurrent backup snapshot consistency.
- [x] Stage only locked runtime dependencies, reject build/test/client tools and generate inventory.
- [x] Build a sandbox-compatible preload and exercise its restricted module surface.
- [x] Boot the compiled server from a temporary directory with only staged dependencies; verify password rotation/token revocation.
- [x] Independently authorize/audit privileged hardware IPC, including bounded offline cases (code/testing; Windows acceptance remains open).
- [ ] Re-audit dependencies immediately before signing; compare actual artifact inventory with staging.

## Windows and installer gates

- [ ] Supply PostgreSQL x64 binaries, required DLLs, extensions and licenses; record source/version/hash.
- [ ] Build `npm run build:win` on the designated Windows host and record SHA-256 of the installer.
- [ ] Verify publisher/signing chain and anti-malware results. Do not blanket-disable protection.
- [ ] Install as a normal Windows user on a clean machine, with no developer tools or external PostgreSQL.
- [ ] Verify generated first-run credentials, forced password change, staff creation and role denials.
- [ ] Prove PostgreSQL requires credentials, binds only loopback, and profile/config/data ACLs exclude unrelated users.
- [ ] Verify actual Electron 45 sandbox/preload, navigation/window restrictions, and IPC denial from untrusted frames.
- [ ] Rehearse existing-installation authentication repair using an isolated copy, then install/upgrade/restart twice.
- [ ] Confirm upgrades and uninstall/reinstall preserve the customer profile and database. Never replace the cluster directory with a fresh one.
- [ ] Exercise startup failures, port conflict, damaged/missing config, disk-full and orphaned processes with understandable diagnostics.
- [ ] Close app/reboot and confirm Express and PostgreSQL stop cleanly; run single-instance/forced-crash tests.

## Retail operational gates

- [ ] Configure store identity, contact information, receipts, register identity, language and fiscal/tax rules.
- [ ] Cash/card/split/credit sales; full/partial/discounted refunds; exact debt settlement and overpayment rejection.
- [ ] Scan real barcodes/weighted goods at cashier speed; verify keyboard focus and Arabic/English text.
- [ ] Simulate network loss before/after commit; restart with pending offline sales and reconcile accepted/rejected quarantine decisions.
- [ ] Count cash, close shift, verify expected/actual/variance and current-drawer refunds after the original sale's shift closes.
- [ ] Print real 58/80mm and Arabic receipts; test no paper, unplug, timeout, spooler rejection and operator reprint without a second sale.
- [ ] Test authorized cash drawer pulse with the actual device; no mock success in production.
- [ ] Owner creates backup, copies it to protected off-device storage; technician restores into a separate database and verifies balances/counts/login/printing.
- [ ] Agree backup frequency, recovery point/time targets, support contact, escalation and rollback ownership.
- [ ] Verify applicable fiscal/receipt/retention requirements for the chosen customer; no unsupported compliance claims.
- [ ] Run representative-volume performance and multi-day soak tests, then obtain named cashier/manager/owner/technician acceptance.

## Repeatable build and validation

Use Node 24 and the committed lockfile on a controlled build host:

```sh
npm ci
npm run lint
npm run typecheck
npm run test:server:unit
npm run test:client
npm run test:desktop
npm run build:server
npm run build:client
npm run compile --workspace=packages/desktop
node scripts/check-preload.cjs
npm run stage:runtime --workspace=packages/desktop
npm audit --omit=dev
npm audit
```

Database/browser scripts require explicit **disposable** loopback databases.
See [QA_REPORT](QA_REPORT.md) for environment fences and commands. `build:win`
includes runtime preflight and `--publish never`; this mission authorizes no
push, deployment or release publication.
