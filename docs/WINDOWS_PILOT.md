# Windows internal pilot

This is an unsigned internal candidate, not commercial or fiscal acceptance. No release publishing, auto-merge or production migration is configured.

## Build

The dedicated `codex/windows-pilot` branch triggers `.github/workflows/windows-pilot.yml` on Windows Server 2022 with Node 24. Manual dispatch is also available once the workflow exists on the default branch. Documentation-only changes do not rebuild the binary.

The workflow installs locked dependencies, runs lint/types and server/client/desktop unit checks, compiles the preload and exercises its sandbox surface. It acquires the exact PostgreSQL archive in `vendor/postgres/windows-runtime.json`, verifies its published SHA-256 **before extraction**, preserves its support files/notices, builds server/client and runs `npm run build:pilot --workspace=packages/desktop`.

The build audits packaged resources and migrations through 038, rejects development tools and local credential/configuration files, then creates a disposable SCRAM cluster from the **packaged** runtime. It tests wrong-password refusal, extensions, dump/restore, compiled migrations, API readiness, initial login and password rotation. These checks do not execute the NSIS installer or certify an interactive Windows session.

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

## Build result

The final successful Actions run, downloadable artifact, installer checksum and draft PRs are recorded here after CI verification.
