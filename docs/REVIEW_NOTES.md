# Latest commercial release assessment — October 30, 2026

**Decision: NOT READY for a paying customer.** Current authoritative reports:
[COMMERCIAL_READINESS](COMMERCIAL_READINESS.md), [RELEASE_BLOCKERS](RELEASE_BLOCKERS.md),
[RELEASE_CHECKLIST](RELEASE_CHECKLIST.md), [INSTALLATION_GUIDE](INSTALLATION_GUIDE.md),
and [QA_REPORT](QA_REPORT.md).

The final commercial pass verified 424 tests: 308 server unit, 54 PostgreSQL,
37 client, 24 desktop and one real browser checkout/interruption/retry. Lint,
type checks, builds, staged-runtime isolation/auth smoke, prior-schema upgrade
and restricted preload smoke pass. Production audit: zero; full audit: six low
Jest-tooling entries, excluded from staging. Electron 45.1.0 is selected, but
actual Windows Electron/hardware/installer acceptance has not been performed.

New fixes: locked-manager PIN denial; private per-employee recovery output before
rotation and old-PIN clearing; register-specific shifts; checkout ownership;
concurrent repayment retries; atomic close; discounted/duplicate/idempotent
refunds with current-shift payouts and prior-tender caps; acknowledged offline
replays; transactional quarantine decisions plus bilingual manager review;
persisted interrupted printing and production mock refusal; locked runtime
staging; bundled sandboxed preload; SCRAM initialization and fail-closed legacy
cluster handling; single-instance/awaited shutdown; compiled migration extension
filtering. Migration **036_refund_idempotency** is additive and required before
using the new refund API, which requires an idempotency key.

P0 gates remain: missing verified PostgreSQL Windows distribution/installer,
per-operation hardware IPC authorization, actual Windows/Electron/data ACL and
legacy-auth upgrade acceptance, and fiscal applicability. Do not treat historical
PASS labels below as certification of these gates. See the current reports for
exact evidence and the environment fences. No business data or remote system was
used; nothing was pushed, deployed or published.

---

## Historical review snapshots (superseded where noted above)

# Security & release-readiness review notes

_Last reviewed: October 2026 — branch `cursor/customers-page-ui-polish`._

This file records the state of the security hardening work so the next pass does
not have to rediscover it. Keep it short and factual; link to files rather than
describing them from memory.

## Local verification — October 30, 2026

This pass reviewed the existing working tree and fixed recovery defects. It is
not an exhaustive security certification or an installer acceptance test.

- Lint and TypeScript checks pass across all three workspaces.
- Server: 304 unit tests pass. Client: 31 tests pass. Desktop: 18 tests pass.
- PostgreSQL 16: 43 integration tests pass on an isolated instance, including
  migrations through 035, full restore with credentials, redacted restore,
  rejecting reused targets, serial/receipt sequence resets, JSON arrays and a
  concurrent-write snapshot regression.
- Server/client production builds and desktop TypeScript compilation pass.
  Client build still reports a large bundle and ineffective dynamic imports.
- Compiled production migrations apply to a fresh database. Compiled production
  server starts and returns HTTP 200 from `/api/v1/health`, then shuts down.
- `.github/workflows/verify.yml` adds the automated checks with PostgreSQL 16
  and an explicitly disposable restore database. YAML parsed locally; the GitHub
  Actions run itself has not been executed or pushed.
- No application data from the configured installation was used or modified;
  all database checks used an isolated PostgreSQL instance under `/tmp`.

### Recovery fixes in this pass

Backups now read all tables and migration metadata inside one read-only,
repeatable-read transaction. Restore accepts only an empty target or the exact
rows created by migrations, replacing those defaults inside a locked transaction.
It checks the target's full table list, quotes mixed-case table names, resets
serial and receipt/order sequences, preserves JSON arrays, and supplies unusable
placeholder hashes for locked employees in redacted backups. Row-count checks
now run before commit, allowing failure to roll back the inserted data.

### Release blockers and remaining acceptance checks

1. **Dependencies (initial review, superseded by the dependency pass below):**
   `npm audit --omit=dev` originally reported 13 affected dependency entries:
   1 critical, 8 high, 4 moderate. This is an advisory inventory, not a finding
   that every issue is exploitable through this application. Includes critical
   `proxy-addr` ([advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)),
   high `axios`, `compression`, `body-parser`, `fast-uri`, `follow-redirects`,
   `form-data`, `ip-address`, `zod`, and moderate `moment`, `qs`, `react-router`
   and `react-router-dom`. Zod's offered fix is a major upgrade; dependency
   changes need their own compatibility pass. No packages were upgraded here.
2. **Browser checkout acceptance:** `packages/client/e2e/checkout.spec.ts` still
   logs in with `cashier123` and authorizes with PIN `2222`. These are rejected
   by the hardened credential policy. Replace the fixture provisioning and run
   the full browser checkout flow before release; it was not run in this pass.
3. **Desktop acceptance:** installer packaging, Windows first-run/upgrade,
   bundled PostgreSQL startup, receipt printer and actual drawer hardware need
   validation on the deployment machine. Desktop compilation is not proof of
   these flows. The existing Electron sandbox caveat remains.
4. **Remaining database acceptance:** real account rotation, concurrent customer
   payment retries and quarantine manager approval need end-to-end acceptance.
   The existing unit tests cover these paths but this pass did not complete
   their full staging checklist.

## Verification snapshot

| Area | Status | Evidence |
| --- | --- | --- |
| Dashboard authentication | **PASS** | `routes/dashboard.routes.ts` mounts `requireAuth`; regression test in `routes/__tests__/authorization.routes.test.ts`. |
| Shift-summary IDOR | **PASS** | `controllers/pos.controller.ts#getShiftSummary` compares `shift.employee_id` with the caller for `cashier`; 3 regression tests in `controllers/__tests__/pos.controller.test.ts`. |
| RBAC: products / inventory / cycle counts / return queue / customers / settings / reports / employees | **PASS** | Route-level `requireRoles`; 17-operation role matrix in `routes/__tests__/authorization.routes.test.ts` (denied role → 403, owning role → not 401/403). |
| Checkout discount authorisation (>20%) | **PASS (fixed in this review)** | `pos.controller.ts` passes `discountAuthorized` only after `pinService.verifyPin` succeeds; `pos.repository.ts#checkout` no longer trusts a bare `manager_id`. Tests: `repositories/__tests__/pos.checkout-discount.test.ts`. |
| Online price enforcement (zero-price sale) | **PASS** | `pos.repository.ts#checkout` rejects `unit_price !== product.selling_price` for online sales; test in `pos.checkout-discount.test.ts`. |
| Offline replay price integrity | **PASS (fixed in the release-blocker pass)** | Offline items are re-priced from the catalogue; prices above catalogue are reduced (audited), prices below catalogue or discounts >20% require a server-verified manager PIN, otherwise the sale is *not posted* and is parked in `offline_sync_quarantine` (`pos.repository.ts#syncOffline`, `POST /pos/sync/quarantine/:id/resolve`). Tests: `pos.checkout-discount.test.ts`. |
| Offline duplicate synchronisation | **PASS** | `syncOffline` de-duplicates on `sales.id` + `idempotency_key` before touching inventory; `repositories/__tests__/pos.sync-offline.test.ts`. |
| Sync identity binding | **PASS** | `syncOffline` uses `req.user.id`, ignoring any `cashier_id`/`employee_id` in the payload; `controllers/__tests__/pos.sync.security.test.ts`. |
| Financial rounding (checkout / split / refund) | **PASS (fixed in the release-blocker pass)** | All monetary math runs in integer cents (`utils/money.ts`, `services/sale-math.ts`); split tenders cannot exceed the total (card > total is rejected); refunds are allocated cumulatively and over-refunds use an exact comparison. Tests: `utils/__tests__/money.test.ts`, `services/__tests__/sale-math.test.ts`, `repositories/__tests__/pos.checkout-money.test.ts`. Rules: `docs/ACCOUNTING_RULES.md`. |
| Customer payments RBAC | **PASS (fixed in the release-blocker pass)** | `customerRepository.recordPayment` locks the customer row, rejects overpayment (`PAYMENT_EXCEEDS_BALANCE`) and zero-debt payments, is idempotent per `idempotency_key`, and moves ledger + balance + drawer cash in one transaction. Tests: `repositories/__tests__/customer.payment.test.ts`. |
| Backup/restore completeness | **PASS (fixed in the release-blocker pass)** | `services/backup.service.ts` exports every table in FK order with a checksum; `services/restore.service.ts` + `npm run db:restore` validate (checksum, schema, FK integrity, empty target, never the live DB) and restore into a separate database inside one transaction. `backup-format.test.ts` covers the validation; the DB-dependent round trip is now verified by `backup_restore.integration.test.ts` on PostgreSQL 16. Runbook: `docs/UPGRADE_AND_RECOVERY.md`. |
| First-run administrator credentials | **PASS (hardened in this review)** | `database/initial-admin.ts` + `database/bootstrap.ts`; `database/__tests__/initial-admin.test.ts`. Bootstrap now aborts before creating the account if a *generated* password cannot be persisted. |
| Password rotation enforcement | **PASS** | `middleware/auth.ts` blocks everything except `/auth/me`, `/auth/logout`, `/auth/change-password` while `must_change_password`; admin cache invalidated on change. |
| PIN security | **PASS (fixed in the release-blocker pass)** | `services/pin.service.ts` keeps the DB-backed 5-attempt lockout; `validators/employee.validator.ts` now requires `MIN_PASSWORD_LENGTH` (12) and rejects trivial PINs (`isWeakPin`), and login refuses published default credentials entirely. |
| Electron renderer security | **PASS (with documented caveat)** | `contextIsolation: true`, `nodeIntegration: false`, prod CSP, `setWindowOpenHandler` denies every window, `will-navigate` blocks non-app URLs, `<webview>` attachment blocked (`main.ts`). `sandbox: false` remains: the preload is CommonJS and requires a sibling module, so enabling the sandbox needs a bundling step (documented in `main.ts`). |
| Electron IPC validation | **PASS (fixed in the release-blocker pass)** | `ipc/validation.ts` schema-validates every payload and `createSenderGuard` verifies `event.sender`/`senderFrame`; backup/restore channels now reject explicitly instead of returning fake success. Tests: `ipc/__tests__/validation.test.ts` (18 cases). |
| Existing-install default credentials | **PASS (fixed in the release-blocker pass)** | One-time startup scan (`database/credential-hygiene.ts`) locks accounts holding published defaults and bumps `auth_epoch`; login refuses them (`CREDENTIAL_RESET_REQUIRED`); `npm run admin:rotate` is the documented recovery. Tests: `database/__tests__/credential-hygiene.test.ts`, `services/__tests__/auth.service.test.ts`. Runbook: `docs/UPGRADE_AND_RECOVERY.md`. |

## Known gaps (priority order)

Resolved in the release-blocker pass (see the table above): money rounding,
backup/restore, employee credential policy, customer payment caps, Electron IPC
validation and the upgrade path for published default credentials.

Earlier follow-ups (see the release blockers above for the current release decision):

1. **Database verification** — migrations and backup/restore are now verified.
   Complete the remaining account-rotation and quarantine approval acceptance
   checks in `docs/UPGRADE_AND_RECOVERY.md` §5 before release.
2. **`sandbox: false`** — compensating controls are documented in `main.ts`;
   enabling the sandbox requires bundling the preload.
3. **Quarantine UI** — `GET /pos/sync/quarantine` and the resolve endpoint exist
   and are tested at the repository level, but there is no manager screen yet;
   cashiers are told (toast) that N sales await approval.
4. **Shift close without a drawer count** — `closeShift` trusts the client's
   `ending_cash`; a variance field/report would make discrepancies explicit.
5. **`customer_transactions` idempotency keys are optional** — the UI always
   sends one, but a direct API caller may omit it (duplicate protection then only
   covers an identical concurrent request via the balance cap).

## ESLint policy

`eslint.config.js` enforces (error): `react-hooks/rules-of-hooks`,
`react-hooks/exhaustive-deps`, `@typescript-eslint/no-floating-promises`,
`@typescript-eslint/no-unused-vars`, `@typescript-eslint/consistent-type-imports`.
Test files are linted again via `packages/client/tsconfig.eslint.json`.

Still disabled, with counts measured during this review (each is a follow-up ticket):

| Rule | Occurrences |
| --- | --- |
| `@typescript-eslint/no-unsafe-member-access` | ~1035 |
| `@typescript-eslint/no-unsafe-assignment` | ~564 |
| `@typescript-eslint/no-explicit-any` | ~270 |
| `@typescript-eslint/no-unsafe-argument` | ~253 |
| `@typescript-eslint/no-misused-promises` | ~194 |
| `@typescript-eslint/no-unsafe-return` | ~102 |
| `@typescript-eslint/no-unsafe-call` | ~82 |
| `@typescript-eslint/no-non-null-assertion` | ~45 |
| `@typescript-eslint/require-await` | ~24 |

## Feedback loop

```bash
npm run lint && npm run typecheck && npm run test:server:unit && npm run test:client && npm run test:desktop
```

Migrations must be applied with `npm run db:migrate` (033 `product_batches`,
034 `must_change_password`, 035 `credential_rotation_and_payment_integrity`)
before starting a hardened server; the desktop launcher runs migrate → bootstrap
automatically.

Operational docs: `docs/ACCOUNTING_RULES.md` (money rules) and
`docs/UPGRADE_AND_RECOVERY.md` (credential rotation, backup/restore, staging
checklist).

## Dependency cleanup — October 30, 2026

Local rollback checkpoint: `7127791`. Compatible dependency patches: `e55e7d5`.
Zod 4 migration and additional Express patch: `f8d59b7`.

The production dependency audit (`npm audit --omit=dev`) now reports **zero**
advisories. Notable resolved versions are Axios 1.21.0, Express 4.22.3,
compression 1.8.2, proxy-addr 2.0.8, Zod 4.6.7 and React Router DOM 7.18.5.
No forced audit fix, lifecycle scripts, or package overrides were used.

The Zod migration updates error customization and `.issues` access while keeping
the API's outward `errors` response key. Optional supplier status keeps its
previous omission behavior. Reference: [official Zod migration guide](https://zod.dev/v4/changelog).
The Router migration removes obsolete v6 future flags and explicitly marks
navigation return values as ignored where handlers do not await navigation.
Four new route-guard tests cover login destination preservation, forced password
rotation, cashier denial and administrator access.

Validation after upgrades: lint, all-workspace type checks, server/client builds,
304 server unit tests, 43 PostgreSQL integration tests, 35 client tests and 18
desktop tests pass (**400 tests total**). The PostgreSQL tests used disposable
review databases and the isolated database server was stopped afterward. The
client build retains its existing large-chunk and dynamic-import warnings.

### Still required before release

- The **full** audit (without `--omit=dev`) reports **36 affected dependency
  entries: 3 critical, 22 high, 4 moderate, 7 low**. These are toolchain and
  Electron/build dependencies; zero production-only findings does not certify
  the distributed desktop application. The desktop's `extraResources` copies
  the entire root `node_modules`, so dev dependencies may enter the installer.
  Review the Electron/toolchain upgrades and stage only required runtime
  dependencies before producing and accepting an installer.
- The full browser checkout test still uses blocked default credentials and
  needs new fixture provisioning plus a real browser run.
- Installer, printer/drawer hardware, upgrade and remaining operational
  acceptance checks above are still outstanding.

No commits were pushed and nothing was deployed in this pass.
