# Windows internal pilot

This is an unsigned internal candidate, not commercial or fiscal acceptance. No release publishing, auto-merge or production migration is configured.

## Build

The dedicated `codex/windows-pilot` branch triggers `.github/workflows/windows-pilot.yml` on Windows Server 2022 with Node 24. Manual dispatch is also available once the workflow exists on the default branch. Documentation-only changes do not rebuild the binary.

The workflow installs locked dependencies, runs lint/types and server/client/desktop unit checks, compiles the preload and exercises its sandbox surface. It acquires the exact PostgreSQL archive in `vendor/postgres/windows-runtime.json`, verifies its published SHA-256 **before extraction**, preserves its support files/notices, builds server/client and runs `npm run build:pilot --workspace=packages/desktop`.

The build audits packaged resources and migrations through 038, rejects development tools and local credential/configuration files, then creates a disposable SCRAM cluster from the **packaged** runtime. It tests wrong-password refusal, extensions, dump/restore, compiled migrations, API readiness, initial login and password rotation. The packaged UI is served only to loopback clients on the API origin; hash routing, bundled fonts, and same-origin requests are checked in Chromium in Arabic and English. API CORS permissions are unchanged. These checks do not execute the NSIS installer or certify an interactive Windows session.

A successful run uploads `windows-internal-<full commit SHA>` for 14 days, containing:

- The unsigned NSIS x64 installer.
- `pilot-evidence/SHA256SUMS.txt` and `build-manifest.json` identifying the exact source commit, application/Node/Electron/PostgreSQL versions and archive checksum.
- Production dependency inventory, PostgreSQL provenance and sanitized smoke/CI summaries.

Failed runs upload sanitized summaries only, never the installer as a verified candidate. CI logs remain available through Actions; temporary passwords, databases and bootstrap files are neither printed nor uploaded.

### Local Windows reproduction

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$env:CYPRESS_INSTALL_BINARY = '0'
npm ci
node --test scripts/tests/windows-runtime.test.cjs
node scripts/prepare-windows-runtime.cjs
npm run build:server
npm run build:client
npm run build:pilot --workspace=packages/desktop
node scripts/audit-windows-pilot.cjs
npx playwright install chromium --only-shell
node scripts/smoke-windows-pilot.cjs packages/desktop/release/win-unpacked/resources
```

All commands must complete successfully. The acquisition archive cache is disposable (`%TEMP%/talaat-pg-cache`, or `TALAAT_PG_CACHE_DIR`). Extracted binaries are ignored by Git. A cached archive is re-hashed on every preparation; never bypass a checksum failure.

## Windows installation worksheet

Record verifier, date, Windows version, source commit, installer SHA-256 and hardware model for every result. All rows below start **NOT TESTED**. Use a disposable normal Windows account and synthetic records; never use a customer's only database for an upgrade/restore rehearsal.

| Scenario | Required evidence | Result |
| --- | --- | --- |
| Clean installation | No developer tools/external PostgreSQL required; installer completes; application opens | NOT TESTED |
| Initial credentials | Per-install secret shown through expected first-run flow; forced password change; no published defaults | NOT TESTED |
| Restricted account | Runs as ordinary user; loopback binding; profile/config/data permissions deny unrelated users | NOT TESTED |
| Restart and shutdown | Repeated launches preserve records; single-instance behavior; API/PostgreSQL exit cleanly | NOT TESTED |
| Upgrade through 038 | Copy a prior synthetic installation; back up first; preserve sales/stock/ledgers; receiving retry columns appear without lost records | NOT TESTED |
| Legacy authentication | Follow existing technician procedure; insecure clusters stop without being recreated | NOT TESTED |
| Uninstall/reinstall | Profile/database preserved; reinstall opens the same records | NOT TESTED |
| Backup restoration | Protected off-device copy restored into a separate empty target; balances, stock and credentials checked | NOT TESTED |
| Native Electron boundaries | Sandbox, preload, navigation/window denial and IPC authorization on actual Windows | NOT TESTED |
| Scanner | Real keyboard-wedge scans, typing, focus and rapid consecutive scans | NOT TESTED |
| Receipt printer | Arabic/English output on supported 58/80 mm devices; paper-out, unplug and recovery | NOT TESTED |
| Reprint | Operator sees interrupted/uncertain job; explicit authorized reprint; no false claim of paper output | NOT TESTED |
| Cash drawer | Authorized pulse, denied unauthorized request, physical behavior recorded | NOT TESTED |
| Soak/fault testing | Multiple registers, partitions, disk-full and power-loss simulations with ledger reconciliation | NOT TESTED |
| Fiscal review | Qualified jurisdiction-specific accounting/fiscal acceptance | NOT TESTED |

Do not disable antivirus or add blanket exclusions. The unsigned candidate has no verified publisher identity; signing and public distribution are separate release work.

## Verification findings

Windows CI exposed two portable-test defects: Unix permission bits cannot be asserted on Windows, and Windows backslashes in an absolute Vitest glob matched no tests. The permission test still checks the requested owner-only mode on all platforms and the actual mode on POSIX. Windows AppData ACL acceptance remains in the worksheet.

Packaging review exposed root-relative renderer assets, missing favicon, file routing, and a file-origin API connection failure. The desktop now loads its bundled interface from the local API origin. Static assets are enabled only by the desktop child and restricted by the actual socket peer to loopback; API paths and dotfiles remain excluded. Navigation/IPC trust is restricted to the exact desktop origin. No generic opaque-origin CORS exception was added. The desktop origin remains `http://localhost:3001/`; an occupied port causes explicit startup failure instead of moving saved carts/offline evidence to a different browser origin.

Retained CI traces exposed delayed dialog autofocus stealing focus after input had begun. The focus trap now leaves focus inside the dialog alone, with a dedicated regression. A real discounted-return assertion reproduced an incorrect unit-price label; the UI now displays the saved line total per unit, without changing refund or ledger calculations. Windows smoke process handling was corrected so PostgreSQL daemons cannot keep inherited capture pipes open, and cleanup also stops a partially started disposable cluster.

Local checks passed: lint/typecheck, 310 server tests, 44 client tests, 50 desktop tests, 18 real bilingual browser journeys, compiled renderer smoke in both languages, PostgreSQL acquisition/preflight tests, and server/client/desktop builds. All 59 PostgreSQL integration tests also passed locally, including a newly provisioned restore target; current-commit CI results are recorded below. Failed synthetic browser runs now retain traces/error contexts for 14 days.

## Build result

Verified on November 4, 2026. The installer was downloaded from Actions and its SHA-256 independently recomputed; it matches both the manifest and checksum file.

- **Build source:** `2f0032e92f31f1200fd815cbd4b000f10e342296`. Later documentation-only commits do not change this binary.
- [Successful Windows Actions run](https://github.com/mohamedtalaat23/talaat-market-system/actions/runs/41747825957).
- [Verified installer and evidence artifact](https://github.com/mohamedtalaat23/talaat-market-system/actions/runs/41747825957/artifacts/13285020690), named `windows-internal-2f0032e92f31f1200fd815cbd4b000f10e342296`, retained for 14 days (expires November 18, 2026, 00:40 UTC).
- [Successful Linux PR verification](https://github.com/mohamedtalaat23/talaat-market-system/actions/runs/41747833143) and [push verification](https://github.com/mohamedtalaat23/talaat-market-system/actions/runs/41747825909) for the same build source.
- Draft [workflow/product integration PR #5](https://github.com/mohamedtalaat23/talaat-market-system/pull/5) and dependent draft [Windows packaging PR #6](https://github.com/mohamedtalaat23/talaat-market-system/pull/6). Neither was merged.

Installer: `Talaat Market-1.0.0-internal-x64-Setup.exe` (168,934,409 bytes).

```text
SHA-256: 42098fef6f467b810e51f778f6cfdb9365692642c75a5b3c991ef8f845fd3734
```

Build inventory records Node **24.22.1**, Electron **45.1.0**, PostgreSQL **16.15**, EDB revision **5**, and 206 staged production packages. PostgreSQL archive SHA-256: `43bb45f173a6f08cf1d29a97a6d8deb119e8e8093a24c00d2d1001a0ccaa8281`; [upstream checksum provenance](https://github.com/EnterpriseDB/edb-installers/issues/731).

Windows CI passed lint/types, all unit suites, preload/runtime boundary checks, acquisition/preflight, installer assembly, packaged-resource audit, disposable SCRAM/extension/dump/restore checks, compiled migrations through 038, packaged API login/password rotation, and Arabic/English renderer smoke. Both final Linux runs passed, including real PostgreSQL integration/restore and all 18 browser journeys. Earlier failed/cancelled attempts are superseded by these complete successful runs; they are not counted as passes.

The worksheet remains **NOT TESTED**: automated assembly and disposable smoke tests do not execute the installer, certify a normal Windows user session, validate an upgrade from a prior installation, or operate physical retail hardware. No business cluster, public release, signing identity or deployment was changed. The original root `.gitignore` and `package.json` edits remain uncommitted and preserved.
