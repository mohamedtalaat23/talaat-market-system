# Bundled PostgreSQL Windows runtime

Run `node scripts/prepare-windows-runtime.cjs` from the repository root. The pinned version, download URL, published SHA-256 and provenance are in `../windows-runtime.json`. Downloads are verified before extraction and re-verified from the disposable cache on reuse.

Build output in this directory is ignored by Git. Preparation retains the complete `bin`, `lib`, `share` and `doc` directories plus vendor root notices and acquisition metadata. Optional pgAdmin/StackBuilder installers and development headers are excluded.

Preflight requires `initdb.exe`, `postgres.exe`, `pg_ctl.exe`, `createdb.exe`, `psql.exe`, `pg_dump.exe` and `pg_restore.exe`, server/extension support files and server licensing. On Windows every tool must report the pinned PostgreSQL version.

The internal pilot workflow additionally starts a disposable SCRAM cluster from the packaged resources and tests extensions, dump/restore, compiled application migrations and API login/password rotation. Actual installer, restricted-user and physical-device acceptance remains separate; see `docs/WINDOWS_PILOT.md`.
