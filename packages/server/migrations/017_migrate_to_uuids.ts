import { type Knex } from 'knex';

/**
 * Migration: Migrate sales and sale_items tables from auto-incrementing integer IDs to UUIDs.
 * This migration preserves historical data and integrity by:
 * 1. Enabling "pgcrypto" extension for gen_random_uuid().
 * 2. Adding temporary uuid_id columns and migrating existing relationships using joins.
 * 3. Dropping legacy primary keys and foreign keys.
 * 4. Renaming old integer columns to legacy_id.
 * 5. Making UUIDs the new primary keys and re-establishing foreign key constraints.
 * 6. Dynamically checking and migrating the customer_transactions.sale_id column if present.
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Enable pgcrypto extension for UUID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

  // 2. Add temporary UUID columns
  await knex.schema.alterTable('sales', (table) => {
    table.uuid('uuid_id').defaultTo(knex.raw('gen_random_uuid()'));
  });

  await knex.schema.alterTable('sale_items', (table) => {
    table.uuid('uuid_id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sale_uuid').nullable();
  });

  // Check if customer_transactions has sale_id column
  const hasSaleIdInCustTx = await knex.schema.hasColumn('customer_transactions', 'sale_id');
  if (hasSaleIdInCustTx) {
    await knex.schema.alterTable('customer_transactions', (table) => {
      table.uuid('sale_uuid').nullable();
    });
  }

  // 3. Populate new UUID columns based on existing values
  // For sales, use idempotency_key if it's a valid UUID string, otherwise fall back to gen_random_uuid()
  await knex.raw(`
    UPDATE sales 
    SET uuid_id = CASE 
      WHEN idempotency_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
      THEN idempotency_key::uuid 
      ELSE gen_random_uuid() 
    END;
  `);

  // Link sale_items to sales using the new UUID
  await knex.raw(`
    UPDATE sale_items si
    SET sale_uuid = s.uuid_id
    FROM sales s
    WHERE si.sale_id = s.id;
  `);

  // Link customer_transactions to sales if column is present
  if (hasSaleIdInCustTx) {
    await knex.raw(`
      UPDATE customer_transactions ct
      SET sale_uuid = s.uuid_id
      FROM sales s
      WHERE ct.sale_id = s.id;
    `);
  }

  // Make new reference columns NOT NULL where required
  await knex.schema.alterTable('sale_items', (table) => {
    table.uuid('sale_uuid').notNullable().alter();
  });

  // 4. Drop old foreign key constraints
  // In Knex/Postgres, the default foreign key constraint name is tablename_columnname_foreign
  await knex.schema.alterTable('sale_items', (table) => {
    table.dropForeign(['sale_id']);
  });

  if (hasSaleIdInCustTx) {
    // Attempt to drop foreign key constraint on customer_transactions.sale_id
    try {
      await knex.schema.alterTable('customer_transactions', (table) => {
        table.dropForeign(['sale_id']);
      });
    } catch (e) {
      // If the foreign key did not exist as a constraint, continue
    }
  }

  // 5. Drop old primary keys
  await knex.raw('ALTER TABLE sales DROP CONSTRAINT sales_pkey CASCADE;');
  await knex.raw('ALTER TABLE sale_items DROP CONSTRAINT sale_items_pkey CASCADE;');

  // 6. Rename columns to keep integer legacy values for fallback/auditing
  await knex.schema.alterTable('sales', (table) => {
    table.renameColumn('id', 'legacy_id');
    table.renameColumn('uuid_id', 'id');
  });

  await knex.schema.alterTable('sale_items', (table) => {
    table.renameColumn('id', 'legacy_id');
    table.renameColumn('uuid_id', 'id');
    table.dropColumn('sale_id');
    table.renameColumn('sale_uuid', 'sale_id');
  });

  if (hasSaleIdInCustTx) {
    await knex.schema.alterTable('customer_transactions', (table) => {
      table.renameColumn('sale_id', 'legacy_sale_id');
      table.renameColumn('sale_uuid', 'sale_id');
    });
  }

  // 7. Establish new primary keys and foreign keys
  await knex.raw('ALTER TABLE sales ADD PRIMARY KEY (id);');
  await knex.raw('ALTER TABLE sale_items ADD PRIMARY KEY (id);');

  await knex.schema.alterTable('sale_items', (table) => {
    table.foreign('sale_id').references('id').inTable('sales').onDelete('CASCADE');
  });

  if (hasSaleIdInCustTx) {
    await knex.schema.alterTable('customer_transactions', (table) => {
      table.foreign('sale_id').references('id').inTable('sales').onDelete('SET NULL');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Rollbacks for primary key migrations of core transactional records are non-trivial 
  // and risk severe dataloss in high-concurrency offline sync production scenarios.
  throw new Error('Rollback of 017_migrate_to_uuids is disabled to protect transactional data integrity.');
}
