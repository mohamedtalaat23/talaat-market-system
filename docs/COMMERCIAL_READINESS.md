# Commercial readiness — October 30, 2026

**Decision: NOT READY for a real paying supermarket customer.**

This is a materially improved engineering candidate for a single supermarket,
Windows desktop and locally managed PostgreSQL. There is no accepted Windows
installer or physical-device evidence. See [blockers](RELEASE_BLOCKERS.md),
[acceptance checklist](RELEASE_CHECKLIST.md), [QA](QA_REPORT.md), and
[installation/recovery](INSTALLATION_GUIDE.md).

## Inspection and architecture

Reviewed the client/POS/auth/settings/dashboard stores and screens, Express
routes/controllers/validators/services/repositories, migrations and tests,
Electron main/preload/IPC/printing/process managers, scripts, CI, dependency
manifests/lockfile, recent commits and operational documentation. This was a
risk-based review across the repository, not a proof of every branch or query.
The working tree was clean at the start. No business database, customer secret,
remote system, deployment or publishing operation was used.

| Layer | Responsibility | Commercial implication |
| --- | --- | --- |
| React + Zustand + Query | cashier UI, local carts, durable offline queue | browser interruption tests and register isolation matter |
| Express + Knex + PostgreSQL | authorization, catalog pricing, stock, ledgers | transactions and constraints are authoritative |
| Electron | local process lifecycle, IPC, printing | requires Windows and sandbox acceptance beyond TypeScript tests |
| Managed PostgreSQL | data under the Windows user profile | upgrades must preserve data and secure local authentication |
| Build scripts + builder | compile, stage locked runtime, assemble installer | dependency inventory and supplied PostgreSQL distribution must be checked |

## Improvements implemented

- Updated compatible dependencies and reviewed Electron 45.1.0; the full audit
  now has only six low-severity Jest-tooling entries. The production-only audit
  and staged dependency closure are separate from Windows artifact acceptance.
- Replaced root `node_modules` copying with a clean, locked production install
  of server and desktop dependencies. Staging verified 206 packages and rejects
  client/build/test tools. Includes `runtime-inventory.json` for artifact review.
- Bundled preload imports and enabled `sandbox: true`; exercised the built
  bridge with only `electron` available. This is not an actual Windows Electron
  sandbox test.
- New managed clusters use SCRAM password authentication and private generated
  administrator credentials. Legacy passwordless clusters are refused without
  changing data. Removed forced immediate database shutdown on startup; added
  single-instance ownership and awaited service shutdown before app exit.
- Fixed PIN approval by accounts still awaiting credential rotation. Recovery
  files are unique per employee, written before changing the account; stale
  PINs are removed unless explicitly rotated.
- Fixed register-specific shift lookup/heartbeat, checkout drawer ownership,
  exact-balance concurrent payment retries, and ledger-atomic shift closure.
- Fixed discounted partial refunds, duplicate refund lines, retry idempotency,
  current-drawer payouts for historical sales, and cent allocation against
  actual prior tender refunds. Migration 036 is additive.
- Offline replays now acknowledge already-posted sales so local queues can
  drain after response loss. Manager decisions are serialized and posted/audited
  in the same transaction. Added an English/Arabic manager review panel.
- Print jobs survive restart; interrupted jobs require operator review before
  reprinting. Production mock printers fail rather than reporting paper output.
- Browser tests use fresh synthetic accounts/registers and real UI interactions;
  test hooks exposing internal application stores were removed.
- Found and fixed a clean production startup failure: Knex was considering
  generated declarations as migrations. Production now loads only `.js` files.

## Product and operational assessment

Cashier flow now has a real browser acceptance path, including a network failure
and retry. Sustained all-day register use, scanner timing, simultaneous hardware
printing and power-loss recovery are not certified. Hardware IPC now has independent main-process authorization, bounded offline
leases and durable audit. P0-2 is resolved at code/testing level; see
[the threat model and limitations](HARDWARE_IPC_SECURITY.md).

Managers have offline approval review and existing return/inventory/reconciliation
screens. Shift close records expected/count/variance in its atomic audit entry;
full counted-cash/variance report acceptance remains required. Rejected offline
sales remain visible locally for operational resolution, rather than deleting
possible cash/goods evidence.

Owners still need technician-assisted installation and restore. Store identity,
receipt footer/contact details, printer configuration, staff roles and backup
routine must be configured before any pilot. Backups are confidential logical
JSON snapshots with corruption detection, not encrypted off-site backups. An
owner must keep a separately protected off-machine copy and rehearse restore.

The interface currently assumes EGP in multiple displays; tax arithmetic is zero
for checkout today. There is no verified fiscal integration or arbitrary
currency/tax regime. Do not sell the candidate as a compliant fiscal register.
The production client bundle is still large and reports ineffective dynamic
imports; no representative-volume benchmark or multi-day soak was completed.

For a proposed Egyptian deployment, have the owner's fiscal adviser and the
integration technician verify applicability, registration, receipt/return
formats, signing/UUID sequencing, offline reporting and retention against the
[ETA integration guide](https://portal.eta.gov.eg/ar/content/e-receipt-services)
and [retail receipt specification](https://sdk.invoicing.eta.gov.eg/documents/retail-receipt-v1-0/).
These references establish a verification task, not a compliance claim.

No cloud service, multi-tenancy, licensing or subscription infrastructure was
introduced. Local commits are permitted; nothing from this mission was pushed,
deployed or published.
