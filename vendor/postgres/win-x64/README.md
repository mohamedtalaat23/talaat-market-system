# Bundled PostgreSQL Runtime

Place the Windows x64 PostgreSQL runtime in this directory before building the
Windows installer.

Required files:

- `bin/initdb.exe`
- `bin/postgres.exe`
- `bin/pg_ctl.exe`
- `bin/createdb.exe`
- `bin/psql.exe`
- `bin/pg_dump.exe`
- `bin/pg_restore.exe`
- All DLLs and support files required by those binaries.

The packaged app copies this directory to `resources/postgres/win-x64` and
starts PostgreSQL as an app-managed local process.
