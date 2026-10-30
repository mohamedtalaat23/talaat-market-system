# P0-2 hardware IPC authorization — October 30, 2026

**P0-2: resolved at the implemented code/testing level.** Windows/Electron and
physical-device acceptance remain open under P0-3/P1-3. Overall product decision
remains **NOT READY**. No business data or remote systems were used.

## Threat model

Originally any code in the trusted renderer frame could directly call exposed
hardware methods, even while logged out. Frame/payload validation protected the
process boundary but established no employee authority. UI PIN dialogs could be
skipped. A forged receipt could trigger a drawer pulse, printer test/config paths
could target arbitrary files, and a denied Electron print could fall through to
browser printing. Queue retry and persisted work were alternate dispatch paths.

Assume the renderer and all IPC arguments (IDs, roles, reprint flags and approval
claims) are untrusted. Trust the installed main process, configured authentication
backend, OS account/filesystem, application signing keys and OS TLS trust store.
Local administrators, modified application binaries or stolen signing keys are
outside this boundary. A stolen valid bearer can exercise its employee's current
permissions; this change does not redesign the application's stateless logout or
localStorage token storage. Application/XSS and OS hardening remain important.

## Architecture

Every registered handler passes through a central main-process gate after sender
verification. Only fixed system version/port and window controls are frame-only.
Unknown/disabled operations fail closed. The preload attaches the existing bearer
and a new UUID per call; it supplies no authoritative employee or role information.
Direct invocations of the registered handlers must satisfy the same gate.

For protected operations main contacts `/api/v1/auth/hardware-session` on a fixed
local backend. It verifies the JWT, bypasses the ordinary employee cache, re-reads
current role/status/rotation/epoch and bounds authority by JWT expiry. Main enforces
the permissions below. Cashier drawer/reprint delegation requires an actual
current manager PIN verified by the backend for that exact operation; a manager
ID or renderer success flag is insufficient. PINs are not written to audit files.

For LAN deployments a technician must set `HARDWARE_AUTHORITY_URL="https://host:port"`
in the private userData `config.env` to the authoritative server issuing employee
tokens. Only an HTTPS origin without userinfo/path/query/fragment is accepted;
normal certificate verification applies and redirects are refused. Renderer LAN
settings cannot change this trust anchor. Update desktop and backend together;
an old/mismatched backend fails closed. HTTPS provisioning/certificate acceptance
on the actual deployment remains manual.

| Operation | Verified authority | Offline |
| --- | --- | --- |
| First queued receipt | cashier/manager/admin | bounded lease |
| Repeated receipt number, irrespective of renderer reprint flags | manager/admin or backend-verified manager delegation | denied |
| Legacy HTML print | manager/admin | denied |
| Drawer opening | manager/admin or backend-verified manager delegation | denied |
| Retry / clear print queue | manager/admin | denied |
| Discover printers | manager/admin | denied |
| Configure or test printer; native file/directory dialogs | admin | denied |
| Queue/status/config reads | cashier/manager/admin | bounded lease |
| Persist offline sale | cashier/manager/admin; existing entries immutable | bounded lease |
| Remove offline sale | verified actor plus backend proof of posted sale using the durable entry's idempotency key | denied |
| Backup/restore/list backup IPC | disabled; use protected server workflows | denied |
| Window controls, app version and local API port | trusted frame only; no hardware/filesystem effects | allowed |

Each accepted request ID is consumed before any side effect and recorded in the
private audit log. Consumed IDs are reconstructed after restart. Receipt-number
claims are also persisted before admission, so a fresh nonce/reprint flag cannot
repeat a claimed receipt as a cashier. Dispatch is serialized to avoid concurrent
claim/replay races. Claims survive hardware failure: an authorized operator must
review/retry, rather than silently printing twice. Receipt text is data, not
permission to issue ESC/POS controls. Embedded control characters are stripped;
automatic drawer pulses from receipt content are removed. Explicit drawer opening
uses its own verified permission. USB paths are limited to COM/LPT or `/dev/usb/lpN`
devices; existing persisted configuration is revalidated too.

Queued work holds an in-memory authorization permit, not a renderer-provided
flag. Every attempt rechecks identity, role/delegation and expiry immediately
before dispatch and audits dispatch/outcome. Recovered jobs have no surviving
permit and remain failed until a newly authorized retry. Browser fallback after
an Electron denial is prohibited. Normal browser print dialogs remain outside
Electron IPC; no claim is made of an OS-wide kiosk/printing lockdown.

## Bounded offline model

- Only an identity verified online in this main-process lifetime can enroll.
- Lease expires at the earlier of **15 minutes since last successful backend
  verification** or the JWT expiry. Cached use never extends it.
- At most **100 offline mutating admissions/dispatches** (sale persistence and
  first receipt printing) per outage lease. Read calls do not spend that budget;
  all offline authority stops when it is exhausted.
- Sensitive manager/admin actions, delegated approvals, reprints and destructive
  queue removal never fall back offline.
- Explicit backend refusal (including revocation, expired credentials, HTTP errors
  or role denial) invalidates the cached identity. Only transport unavailability
  permits grace use. A backwards wall clock clears authority.
- Restart loses leases and job permits: cold offline login/recovery is denied.
  Reconnect to renew. There is deliberately no universal offline bypass token.
- Revocations cannot be discovered during an outage; the bounded stale-identity
  interval is an explicit remaining risk, not immediate offline revocation.
- Offline sale persistence is awaited before cart/tally success; denial/disk error
  retains the cart. Queue entries are deleted locally only after acknowledged
  durable deletion; failure retains recovery evidence. Login rehydrates the queue.

This is a defined safety/usability tradeoff. A prolonged outage or cold restart
requires reconnection; unrestricted offline administration is not supported.

## Audit

`userData/hardware-audit.ndjson` records operation, main-observed employee,
verified approving manager where applicable, request ID, UTC timestamp and result
(authorization, denial, dispatch, success or failure). Writes are synchronous and
fsynced before dispatch; inability to audit denies the side effect. Worker results
retain the admitting actor/request. Raw tokens, PINs and receipt data are absent.
A receipt queue acknowledgment means admitted work, not proof of paper output.

The audit and receipt-claim files require appropriate Windows ACLs. They are
local evidence, not a remotely anchored tamper-proof ledger. Do not delete/rotate
these files casually: audit history is also used for replay denial. Retention,
large-file startup cost, disk failure and recovery need deployment acceptance;
a corrupted audit fails closed. A crash after hardware dispatch but before the
result record remains an indeterminate physical outcome requiring operator review.

## Verified evidence

- Gate tests cover real/forged roles and identities, missing auth, scoped manager
  delegation, manager/admin permissions, nonces/reconstruction, bounded offline
  expiry/budget, cold start, explicit revocation, clock rollback, audit write failure,
  hardware failure response and queued permit checks/results.
- Registered-handler tests exercise direct/alternate IPC calls, concurrent receipt
  claims, raw ESC/POS injection and arbitrary printer-path rejection.
- PostgreSQL/HTTP integration verifies actual signed JWTs, DB roles rather than
  forged JWT role claims, epoch revocation, expiry, password-rotation denial,
  manager PIN approval and unacknowledged queue-removal refusal.
- Client tests prove no browser fallback on denial and no destructive local queue
  update after persistence/removal failure.
- `scripts/test-hardware-runtime.cjs` exercises the compiled main-process gate
  against a local synthetic HTTP authority, fsynced disk audit, replay after
  reconstruction, explicit refusal, and HTTPS authority restrictions.
- Full regression results and limitations are recorded in `QA_REPORT.md`.

No actual Electron binary/headless display was available for a native runtime
launch here. The restricted preload VM and Node HTTP smoke are not Electron or
Windows acceptance. Required physical checks: legitimate manager/cashier PIN and
reprint workflows, offline lease exhaustion/recovery, actual device naming,
printer faults/drawer pulses, sandbox/frame restrictions, file ACLs and audit
recovery. TLS LAN deployment must be tested with the chosen server certificate.

## Every modified/added file in this mission

- `.github/workflows/verify.yml`
- `docs/COMMERCIAL_READINESS.md`
- `docs/HARDWARE_IPC_SECURITY.md`
- `docs/INSTALLATION_GUIDE.md`
- `docs/QA_REPORT.md`
- `docs/RELEASE_BLOCKERS.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/REVIEW_NOTES.md`
- `packages/client/src/features/pos/components/LANSyncManager.tsx`
- `packages/client/src/features/pos/components/ManagerOverrideModal.tsx`
- `packages/client/src/features/pos/components/POSKeyboardHandler.tsx`
- `packages/client/src/features/pos/components/POSSummary.tsx`
- `packages/client/src/features/pos/components/PaymentModal.tsx`
- `packages/client/src/features/pos/components/ReceiptPreviewModal.tsx`
- `packages/client/src/features/pos/components/TransactionSearchModal.tsx`
- `packages/client/src/features/pos/services/SyncService.ts`
- `packages/client/src/features/pos/services/__tests__/hardware-failure.test.ts`
- `packages/client/src/features/pos/services/printer.service.ts`
- `packages/client/src/features/pos/stores/useLANStore.ts`
- `packages/client/src/types/index.ts`
- `packages/desktop/src/ipc/__tests__/authorization.test.ts`
- `packages/desktop/src/ipc/__tests__/hardware-boundary.test.ts`
- `packages/desktop/src/ipc/__tests__/print-recovery.test.ts`
- `packages/desktop/src/ipc/authorization.ts`
- `packages/desktop/src/ipc/escpos-formatter.ts`
- `packages/desktop/src/ipc/handlers.ts`
- `packages/desktop/src/ipc/print-queue.ts`
- `packages/desktop/src/ipc/validation.ts`
- `packages/desktop/src/preload.ts`
- `packages/server/jest.config.js`
- `packages/server/src/controllers/pos.controller.ts`
- `packages/server/src/repositories/__tests__/hardware.integration.test.ts`
- `packages/server/src/routes/auth.routes.ts`
- `packages/server/src/validators/pos.validator.ts`
- `packages/server/vitest.config.ts`
- `scripts/check-preload.cjs`
- `scripts/test-hardware-runtime.cjs`
