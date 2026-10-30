# P0-2 verification update — October 30, 2026

P0-2 is resolved at code/testing level; native Windows/Electron/physical acceptance
is still open. See [HARDWARE_IPC_SECURITY](HARDWARE_IPC_SECURITY.md) for the full
threat model, permissions, offline policy, audit/replay model and changed files.

Final rerun: **453 tests passed** — server unit 308, PostgreSQL integration 56
(including two new real JWT/role/PIN/epoch hardware authority tests, no skipped
restore tests), desktop 49, client 39 and real Chromium checkout 1. Lint and all
workspace type checks pass; server/client builds and desktop/preload compilation
pass. Restricted preload VM passes. The compiled Node/local-HTTP hardware smoke
passes, including fsynced audit, persisted replay consumption and explicit
revocation/HTTPS authority restrictions. CI includes this smoke but its remote
run was not executed. Existing bundle/native-config warnings remain.

New tests exercise the main gate and actual registered handlers rather than UI
checks alone: unauthorized and forged identities, manager/admin/scoped PIN
permissions, direct/alternate calls, concurrent fresh-nonce reprints, stale or
replayed requests, expiry/budget/cold restart/revocation/clock rollback, audit and
hardware failures, queued dispatch rechecks/results, ESC/POS injection and arbitrary
printer paths. Client tests prevent fallback printing and destructive queue state
updates after denial. No real employee credentials or business databases were used.

No native Electron binary/headless display was available here. HTTPS LAN deployment,
actual Windows renderer/frame restrictions, ACLs, device naming/drivers, physical
printing/drawer faults, clock/power/disk recovery and operational offline limits
require the deployment acceptance checklist. The Linux Node smoke is not Electron
or hardware certification. No push, deployment or release publication occurred.

---

## Previous commercial-pass snapshot (historical results follow)

# QA report — October 30, 2026

**Release decision: NOT READY.** Tests use synthetic records only. Passing these
checks is not Windows installer, hardware, fiscal or operational certification.

## Environment and isolation

Linux build host, Node 24.16.0, npm 11.13.0, PostgreSQL 16 on loopback port 55439,
and Playwright Chromium headless installed under `/tmp/talaat-playwright`.
The host OS is not officially supported by Playwright; its Ubuntu fallback
browser completed the real UI test. No business database, production credentials
or remote system was used. Disposable databases were explicitly named and
configured, not selected by the project's `.env` defaults. The isolated database
server is shut down after verification.

Start commit: `c6f1da5`, working tree clean. Existing lint/type/client/desktop
baselines were re-executed; existing server regressions were retained and run
throughout the fixes. Early failures exposed stale fixtures/mocks and real
implementation defects. The table below records the final outcomes, not those
intermediate failures.

## Final automated results

| Check | Outcome | Scope / evidence |
| --- | --- | --- |
| `npm run lint` | PASS | zero lint errors/warnings |
| `npm run typecheck` | PASS | server, client, desktop |
| Server Jest | **308 passed** | 26 suites, includes manager rotation denial and recovery-file isolation |
| PostgreSQL Vitest | **54 passed** | 7 files, recovery tests explicitly enabled, none skipped |
| Client Vitest | **37 passed** | 8 files, includes offline approval role boundary/failure states |
| Desktop Jest | **24 passed** | 3 suites, IPC validation, authentication policy and interrupted/mock printing |
| Playwright Chromium | **1 passed** | real login → manager PIN → dedicated register → shift open → product search → interrupted request → retry → cash sale/change/cart clear |
| Total test cases | **424 passed** | counts above; smoke scripts are additional evidence |
| Server/client builds | PASS | compile and Vite bundle; existing large-chunk/dynamic-import warnings remain |
| Desktop compile/bundle | PASS | TypeScript and self-contained preload |
| Restricted preload VM | PASS | only `electron` can be required; bridge invokes expected IPC surface |
| Production-only runtime staging | PASS | clean `npm ci --omit=dev` for server/desktop; 206 packages; forbidden client/build/test packages absent |
| Isolated production runtime | PASS | copied outside repository; compiled migration/bootstrap, health HTTP 200, password gate, rotation and old-token rejection |
| Upgrade smoke | PASS | schema through 035 → 036; synthetic balance preserved and published default credential locked |
| Windows runtime preflight | EXPECTED BLOCK | missing PostgreSQL binaries; no installer built |
| Dependency audit | runtime 0; full 6 low | full remaining entries are Jest/deepmerge tooling, not present in staged runtime |
| Whitespace/working changes | PASS | `git diff --check` |

Dependency graph versions include Electron 45.1.0 and electron-builder 26.18.0.
These are manifest/lockfile facts; the actual Electron Windows binary was not
launched here. The shipped artifact still needs inspection, including builder-
collected dependencies, PostgreSQL native libraries and license notices.

## Material regression coverage

`commercial.integration.test.ts` exercises committed financial records:

- competing requests for the final stock unit: exactly one success;
- duplicate checkout key: one sale, one inventory decrement;
- another employee's drawer: rejected before posting;
- concurrent exact-balance payment retry: one ledger row and one duplicate response;
- competing distinct repayments: balance cannot be overpaid;
- cart-discount refund in three partial steps: exact total and stock restoration;
- duplicate refund lines: rejected; duplicate refund keys: one refund under concurrency;
- historical sale returned in a new shift: current drawer charged, original closed
  drawer snapshot unchanged;
- manager decisions on a quarantine row: one transition/post, later sync
  acknowledges the posted sale so the cashier queue can drain;
- competing full purchase receives: one receipt/stock increment;
- terminating a transaction's own PostgreSQL connection: inserted fixture rolls back.

The sale-math regression also covers actual prior tender history for a three-cent
cash/card/debt split, preventing a rounded cent from being refunded twice to one
tender. Existing full/partial reversal tests remain in place.

`backup_restore.integration.test.ts` verifies dry run, checksum refusal before
writes, a full restore, reused-target refusal, sequence recovery, JSON arrays,
locked credential-free employees and exclusion of concurrent writes from the
backup snapshot. Pure-format tests cover incomplete data, references and schema
mismatch. No destructive promotion was performed.

The staged-production smoke found a real runtime failure that source tests did
not: Knex considered `.d.ts` files in compiled migration output. Explicit
`loadExtensions` now limits production to JavaScript, and the isolated smoke
then passed.

## Reproduction

Ordinary checks/builds are listed in [RELEASE_CHECKLIST](RELEASE_CHECKLIST.md).
For database checks provision a new **disposable** source, separate freshly
migrated restore target, loopback host and explicit credentials/secrets. Set
`NODE_ENV=test`, `DB_NAME=<disposable_test>`, `DB_HOST=127.0.0.1`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `SESSION_SECRET`, `BACKUP_DIR` and
`LOG_DIR` to isolated locations. Do not rely on an installation's `.env`.

```sh
npm run db:migrate
DB_NAME=<fresh_restore_test> npm run db:migrate
RESTORE_TEST_DATABASE=<fresh_restore_test> npm run test:server:integration
TALAAT_E2E=1 PLAYWRIGHT_BROWSERS_PATH=/tmp/talaat-playwright npm run test:e2e
```

The recovery suite truncates only the explicitly supplied disposable restore
**target** between its restore cases. The source gets synthetic fixture records.
E2E creates unique cashier/manager/register/product fixtures rather than seeding
or deleting an installation. It rejects missing isolation variables before
starting servers or importing database configuration. Browser servers never
reuse arbitrary running services.

For compiled production smoke, first build server/client and stage dependencies,
then create a new empty `*_test` database and use explicit test credentials and
strong generated secrets with `NODE_ENV=production`:

```sh
TALAAT_RELEASE_VERIFY=1 node scripts/verify-runtime.cjs
# Use a different newly created empty database for upgrade verification:
TALAAT_RELEASE_VERIFY=1 node scripts/verify-upgrade.cjs
```

The runtime script copies to a private temporary directory, starts only its
server, checks auth/health, then stops it. The upgrade script builds a synthetic
prior schema and applies the additive migration; it must never target an existing
installation. No real database was rolled back, dropped or promoted.

## Explicitly untested / limited

Actual Electron 45 sandbox execution, Windows ACLs, bundled PostgreSQL binaries,
normal Windows-user installation/upgrade/uninstall, single-instance/process
crash recovery, physical scanner/printer/drawer, paper-out/unplug and Arabic
rendering. Also not completed: reauthorization of all privileged hardware IPC,
full receipt/tax/fiscal integration, malicious concurrent PIN guessing, arbitrary
power-loss/commit-boundary injection, disk-full and retention/volume soak,
multi-terminal offline partition/rejection reconciliation, and an owner-performed
restore/promote drill. Full card/split/credit browser journeys remain future E2E
acceptance despite server-side tender regression coverage.

No code signing, artifact publication, remote CI run, push or deployment was
performed. CI definition was updated locally; its remote run is unverified.

## Change/evidence map

| Area | Main changed files | Reason / linked regression |
| --- | --- | --- |
| Runtime assembly | `scripts/stage-runtime.cjs`, `packages/desktop/electron-builder.yml`, desktop manifest/lockfile | clean production closure and inventory; isolated runtime smoke |
| Sandbox/lifecycle | `scripts/build-desktop.cjs`, `scripts/check-preload.cjs`, `packages/desktop/src/main.ts` | bundle preload, enable sandbox, single instance, await shutdown |
| Managed database | `packages/desktop/src/postgres-manager.ts`, `postgres-security.ts` | SCRAM, persist admin recovery secret, safe startup/refuse legacy trust; HBA policy tests |
| Printing | `packages/desktop/src/ipc/print-queue.ts`, `print-recovery.test.ts` | durable jobs, explicit interrupted recovery, serialized processing, mock refusal |
| Recovery | `packages/server/src/database/initial-admin.ts`, `rotate-credentials.ts` | persist unique recovery files before mutation, clear stale PIN; credential helper regression |
| Financial safety | `packages/server/src/repositories/pos.repository.ts`, `customer.repository.ts`, `services/sale-math.ts`, migration 036 | locks/idempotency/refund allocation/drawer attribution; commercial integration and sale-math tests |
| Approvals | `packages/server/src/services/pin.service.ts`, client `OfflineApprovalPanel.tsx` | deny unrotated managers; transactionally reviewed quarantine; service/UI/concurrency regressions |
| Register/browser | client `POSPage.tsx`, `useShiftHeartbeat.ts`, `e2e/setup.ts`, `checkout.spec.ts`, Playwright config | correct register query, no test-store hooks, isolated fixtures, real interruption/retry path |
| Runtime migrations | `packages/server/src/config/database.ts` | do not load `.d.ts` migrations; isolated compiled smoke |
| Automation/docs | `.github/workflows/verify.yml`, root engines, release reports | repeatable checks including staging/browser and explicit evidence gaps |
