# Release blockers — October 30, 2026

**Release decision: NOT READY.** Evidence is in [QA_REPORT](QA_REPORT.md).
Do not interpret a green test run or production-only npm audit as retail acceptance.

| ID | Priority | Outstanding issue | Evidence / acceptance requirement |
| --- | --- | --- | --- |
| P0-1 | P0 | Windows installer cannot yet be produced/accepted | `vendor/postgres/win-x64` contains only a README. Preflight intentionally fails on missing binaries. Supply a supported, provenance-checked PostgreSQL distribution including DLLs, extensions and notices, build on Windows, and verify clean install/upgrade/uninstall preserves the profile data. |
| P0-2 | Code/testing resolved | Independent hardware IPC authorization implemented | Central main-process gate, fresh backend identity/role/PIN checks, persisted replay/receipt claims, bounded offline leases, durable audit and dispatch rechecks. See [security design and evidence](HARDWARE_IPC_SECURITY.md). Native Windows acceptance remains P0-3/P1-3. |
| P0-3 | P0 | Actual Electron 45 + Windows lifecycle and security acceptance | Preload VM smoke and compilation pass; no actual Windows renderer, restricted account, user-profile ACL, process crash, power-loss, single-instance race or startup/shutdown acceptance. Verify the bridge with sandbox on, no Node globals, denied navigation/windows and guarded IPC on the real runtime. |
| P0-4 | P0 | Legacy database authentication transition needs supervised acceptance | New clusters use SCRAM; old clusters without the administrator secret or with trust/peer/ident rules stop. Technician must back up, secure the existing cluster/config, prove password denial, preserve records and rehearse the upgrade. No automatic destructive conversion was attempted. |
| P0-5 | P0 for customer launch | Fiscal and accounting applicability unresolved | Checkout tax is currently zero and EGP is assumed in UI. No claimed ETA/fiscal certification. Decide the launch jurisdiction and verify its requirements with qualified advisers and the relevant authority before financial use. |
| P1-1 | P1 | Broader fault/soak acceptance | No disk-full, process kill at every commit/print boundary, network partition across several registers, real-size performance/load, or multi-day run. Unit/integration/browser interruption cases are bounded evidence. |
| P1-2 | P1 | Offline rejection and register handover workflow | Rejected quarantine entries remain on the local queue; automatic deletion would discard possible money/goods evidence. Implement a clear reconciled/rejected outcome workflow. Check cashier handover against the new server-enforced shift ownership rule; sharing another cashier's drawer is rejected. |
| P1-3 | P1 | Printing/device acceptance | Windows spooler success does not prove paper output. Validate device discovery, Arabic/58/80mm receipts, unplug/paper-out, explicit reprint, drawer pulse and interrupted-job recovery with real devices. Verify persisted queue size/retention under a full trading day. |
| P1-4 | P1 | Owner recovery/support experience | Restore and legacy authentication repair remain technician tasks. Add support diagnostics and validate the plain-language owner runbook. Backups must be copied off-device and protected. |
| P2-1 | P2 | Remaining dependency advisories | Six low-severity Jest/deepmerge-related development-tool entries remain; excluded from the staged runtime. No forced downgrade to obsolete Jest/ts-jest was made. Re-audit at release time and inspect the final artifact inventory. |
| P2-2 | P2 | Bundle/build polish | Large client chunk and dynamic-import warnings remain. Updated Vite also warns about future native-config loading. Optimize after measuring representative workloads. |

## Blockers fixed in this mission

Unsafe root dependency packaging; critical/high/moderate npm findings in the
current graph; unsandboxed preload configuration; new-cluster trust auth; forced
immediate PG shutdown; missing awaited app shutdown; approval by rotation-locked
managers; recovery-file overwrite/loss; wrong-register shift lookup; concurrent
payment retry rejection; missing checkout shift binding; discounted/duplicate/
retried/historical-shift refund errors; offline acknowledgement and decision races;
production mock-print success; interrupted print-job loss; broken browser
fixtures; production declaration-file migration loading.

The list is intentionally not a claim that all other code paths are secure.
