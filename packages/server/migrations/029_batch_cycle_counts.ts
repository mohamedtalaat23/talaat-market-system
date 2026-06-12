import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cycle_counts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('type', ['blind', 'guided', 'investigation']).notNullable();
    table.enum('status', ['draft', 'pending_approval', 'posting', 'posted', 'cancelled']).notNullable().defaultTo('draft');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('employees');
    table.integer('assigned_to').unsigned().nullable().references('id').inTable('employees');
    table.integer('approved_by').unsigned().nullable().references('id').inTable('employees');
    table.decimal('total_variance_value', 12, 2).defaultTo(0);
    table.string('location').nullable();
    table.uuid('idempotency_key').nullable().unique();
    table.jsonb('posting_snapshot').nullable();
    table.timestamp('expires_at').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('posted_at').nullable();
  });

  await knex.schema.createTable('cycle_count_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('cycle_count_id').notNullable().references('id').inTable('cycle_counts').onDelete('CASCADE');
    table.integer('product_id').unsigned().notNullable().references('id').inTable('products');
    table.string('location').nullable();
    
    table.decimal('system_qty', 10, 2).notNullable();
    table.decimal('counted_qty', 10, 2).notNullable();
    table.decimal('variance', 10, 2).notNullable();
    table.decimal('unit_cost', 12, 2).nullable();
    table.decimal('final_variance_cost', 12, 2).nullable();
    table.timestamp('snapshot_timestamp').defaultTo(knex.fn.now());
    
    table.enum('recount_level', ['first', 'second', 'final']).defaultTo('first');
    table.text('notes').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Constraints
    table.unique(['cycle_count_id', 'product_id'], { indexName: 'idx_cycle_count_items_unique' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cycle_count_items');
  await knex.schema.dropTableIfExists('cycle_counts');
}
