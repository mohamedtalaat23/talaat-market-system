# Product improvement implementation — November 2, 2026

For the November 4 real-service daily-workflow review, receiving retry migration and bundled offline fonts, see [DAILY_WORKFLOW_REVIEW](DAILY_WORKFLOW_REVIEW.md).

This delivery improves the existing single-store Windows/LAN product. It is **not commercial release acceptance**. Existing Windows, physical-device, fiscal and soak-test gates remain in force.

## Delivered behavior

- A light, deep-teal workspace with grouped, role-filtered navigation, a collapsible sidebar, skip navigation, visible focus, equal-size Arabic/English layouts, quieter cards/buttons and reduced-motion CSS.
- Shared page titles and localized loading/retry states; removal of the inactive notification bell and misleading queue-as-syncing display.
- Route-level lazy loading, plus removal of ineffective dynamic imports of already shared modules.
- Current catalog prices and availability for recent/top-selling POS cards, replacing historical receipt prices, assumed activity, and fabricated stock. Delayed scanner refocus checks for open dialogs.
- Native accessible confirmation dialogs replace browser confirmation prompts for purchases, customer deletion, suspended-cart discard and print-history clearing. Failed purchase requests keep the review dialog open.
- Catalog-to-stock links, inventory-to-purchasing links, supplier-to-purchase links, and purchase-to-supplier links. Inventory and purchase filters accept these contextual query parameters.
- Dashboard request failures and malformed statistics produce a retry state rather than crashing or inventing zeroes. Cashier quick actions no longer link into management-only screens.
- Administrator setup checklist stored through existing server settings; backup creation and history; safe diagnostic download containing version, service/database state, printer type/paper width and queue counts. Checklist completion records administrator review; it does not certify hardware or release readiness.
- Manager review now includes rejected offline sales. Reconciliation requires manager PIN verification and notes explaining cash/goods settlement, retains original evidence/rejection notes, writes an audit event and does not post a sale or alter inventory. Repeated reconciliation is idempotent.
- Pending/rejected offline sales cannot silently become posted sales when catalog prices change. Replays acknowledge reconciled rejections separately from posted sales. The local queue removes only server-acknowledged entries. The destructive LAN queue-clear control has been replaced with manager review navigation.

## Baseline issue inventory

| Priority | Reproducible baseline issue | Result |
| --- | --- | --- |
| P1 | Dashboard statistics request fails; render dereferences missing data | Explicit localized retry state; malformed metric payloads also rejected |
| P1 | Rejected offline replay is retried after catalog prices change | Server decision guard plus audited reconciliation and durable acknowledgement |
| P1 | Recent/top-seller cards copy receipt-time prices and assume stock/activity | Fetch current product records; omit inactive/unavailable records |
| P1 | LAN settings can clear unposted local evidence | Destructive action removed; manager reconciliation entry point provided |
| P2 | Queue count always appears to be actively syncing | Pending/review/rejected states and explicit retry; actual in-flight indication |
| P2 | Purchase confirmations use browser dialogs; failed action lacks retained context | Accessible confirmation with failure feedback and focus restoration |
| P2 | Customer-detail heading uses near-white text on a light surface | Foreground contrast corrected |
| P2 | Inactive notification bell, oversized decoration and inconsistent page headings | Shared shell, page headings and calmer component styling |
| P2 | No owner-facing saved setup or backup history workflow | Administrator setup/recovery page and safe diagnostics |

## Interfaces and migration

Apply additive migration `037_offline_reconciliation` before deploying the new server/client together. No existing business database was migrated during implementation.

- `GET /pos/sync/quarantine?status=pending|approved|rejected` retains manager/admin access. Rejected entries prioritize unresolved records.
- Existing `POST /pos/sync/quarantine/:id/resolve` also accepts `decision: "reconcile"`. Existing manager ID/PIN verification applies; notes must contain at least 10 trimmed characters. Only rejected records can be reconciled.
- `/pos/sync` optionally returns `reconciledIds`; these are acknowledgements of rejected entries, **not posted sale IDs**. Rejected/review-required errors have explicit codes.
- Setup stores boolean `setup_identity`, `setup_register`, `setup_staff`, `setup_printer`, `setup_receipt`, and `setup_backup` through existing administrator-only settings routes.
- Backup and health routes are reused. No new diagnostics endpoint or sensitive export was added.

Original user edits to root `package.json` and `.gitignore` were preserved. Nothing was pushed or deployed.

## Evidence and acceptance journeys

The before/after images under [qa/roadmap](qa/roadmap) use synthetic records. Reference screenshots cover dashboard, catalog, checkout and setup/recovery in both languages, at 1366×768 and 1920×1080. These are browser evidence, not native Electron or physical printer evidence.

| Journey | Evidence |
| --- | --- |
| Login, manager authorization, open shift, search, cash payment, failed request and retry | Real browser/API/PostgreSQL test in English and Arabic |
| Setup persistence, backup controls, safe diagnostics, purchase confirmation cancellation/failure, dashboard unavailable state | Bilingual browser tests with explicit synthetic API fixtures |
| Refunds, stock, receiving, customer payments, drawer/shift ownership, concurrent retries | Existing server suites and PostgreSQL integration acceptance |
| Offline rejection, changed catalog price, reconciliation replay, original evidence and single audit | New PostgreSQL regression tests and client queue tests |
| Backup integrity and restore | Fresh disposable restore database; existing populated restore target correctly refused on rerun |
| Print recovery and IPC permissions | Desktop unit coverage; real Windows/device acceptance remains outstanding |

Current checks: typecheck and lint pass; 42 client tests, 308 server unit tests and 58 PostgreSQL integration tests pass. Desktop compilation succeeds and the unchanged desktop suite passed 49 tests at baseline. All four bilingual checkout and management acceptance tests pass together (31.4 seconds). Server and client production builds succeed. Full packaging fails at a GitHub dependency download (`EAI_AGAIN`); no accepted installer was produced.

Baseline checks passed: typecheck, lint, 39 client tests, 308 server unit tests, 49 desktop tests. Initial server HTTP tests needed local-socket permission; they passed after rerunning outside that restriction.

A local catalog benchmark adds 10,000 synthetic products with inventory records to a fresh database and runs 30 measured warm samples per operation. Recorded median / p95: catalog **16.61 / 19.52 ms**, POS search **15.33 / 22.84 ms**, checkout **3.62 / 5.65 ms**. This is repository latency on this machine, excluding network, rendering, printing and concurrent terminals. The guarded `scripts/benchmark-retail.ts` refuses non-test or non-loopback targets and deliberately retains synthetic records only in the disposable test database.

The original main JS bundle was **1,629.44 kB** uncompressed; route splitting reduced it to **320.75 kB**, with features loaded separately. This measures the main file, not the sum of all lazy chunks or real startup time.

## Remaining release acceptance

- Supply the supported bundled Windows PostgreSQL runtime and validate installer, upgrade, profile preservation, restricted-user permissions, crash recovery and shutdown on actual Windows hardware.
- Validate Arabic/English receipts, 58/80 mm paper, scanner timing, paper-out, disconnects, explicit reprint, drawer pulse and spooler ambiguity on actual devices.
- Complete multi-register network-partition, disk-full, power-loss and multi-day soak acceptance. Local unit/browser runs do not establish these guarantees.
- Obtain jurisdiction-specific fiscal/accounting review and implement any required fiscal integration before commercial financial use.
- Technician-assisted restore and protected off-device backup copying remain operational responsibilities. No automated off-site backup was introduced.
- The redesign establishes shared patterns and reference screens; a screen-by-screen native-device usability review and exhaustive translation audit remain acceptance work. Existing web-font loading still falls back to installed fonts when offline.
