# Migrations

Database migrations are managed by **Knex.js**.

## Directory Structure

```
migrations/
├── 001_initial_schema.ts    # Phase 1: Core tables (products, employees, inventory...)
├── 002_add_indexes.ts       # Phase 1: Performance indexes
├── 003_add_audit_log.ts     # Phase 1: Audit trail table
└── ...                      # Phase 2+: Added as features are built
```

## Commands

```bash
# Run all pending migrations
npm run migrate --workspace=packages/server

# Roll back the most recent migration batch
npm run migrate:rollback --workspace=packages/server
```

## Migration Naming Convention

```
NNN_description_in_snake_case.ts
│   │
│   └── Descriptive name of what this migration does
└────── Zero-padded sequential number
```

## Rules

1. **Never modify** an existing migration that has been run in production
2. To fix a migration, create a **new** migration that corrects it
3. Migrations must be **reversible** — always implement `down()` functions
4. Test migrations on a **copy** of the database before running on production

## Phase 1 Schema (Coming in next implementation step)

The initial schema will create these tables:
- `categories` — product categories (hierarchical)
- `products` — product catalog with barcodes and pricing
- `inventory` — stock levels per product
- `employees` — system users (cashiers, managers, admin)
- `customers` — customer records for loyalty tracking
- `suppliers` — supplier directory
- `settings` — key-value application settings
- `audit_log` — immutable record of all business actions
