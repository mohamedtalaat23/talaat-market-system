# Visual acceptance evidence

All records in these captures are synthetic. No business database was used.

- `before-*`: pre-change production build, dashboard/catalog, Arabic and English, 1366×768.
- `after-*-1366.png`: final reference screens at 1366×768.
- `after-*-1920.png`: final reference screens at 1920×1080.
- `after-*` without a width suffix: intermediate review captures, retained for comparison; use width-suffixed images for final acceptance.

Checkout captures use the isolated real API/PostgreSQL browser fixture. Management captures use explicit mocked API responses and verify layout, setup persistence, backup controls, diagnostics and confirmation behavior; they do not prove physical backup/device operation. The separate PostgreSQL integration suite verifies backup and restore.

Automated screenshots and browser tests are in `packages/client/e2e/checkout.spec.ts` and `polish.spec.ts`. The test config refuses to run without `TALAAT_E2E=1`, loopback `DB_HOST`, and an explicit `DB_NAME` ending in `_test`. Supply a fresh migrated disposable database and set `E2E_CLIENT_PORT` if 5173 is already occupied. Use a separately migrated, empty `RESTORE_TEST_DATABASE` for restore integration tests.

See [the implementation report](../../PRODUCT_IMPROVEMENTS.md) for verified outcomes and outstanding release acceptance.
