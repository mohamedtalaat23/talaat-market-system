import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create NonRestockReason Lookup Table
  await knex.schema.createTable('NonRestockReason', (table) => {
    table.string('reason_code', 30).primary();
    table.string('description', 255).notNullable();
  });

  // Insert default approved codes
  await knex('NonRestockReason').insert([
    { reason_code: 'DAMAGED', description: 'Item physically damaged' },
    { reason_code: 'EXPIRED', description: 'Item past expiration date' },
    { reason_code: 'OPENED', description: 'Item seal broken or opened' },
    { reason_code: 'CONTAMINATED', description: 'Item contaminated or spoiled' },
    { reason_code: 'SUPPLIER_RECALL', description: 'Recalled by supplier' },
    { reason_code: 'CUSTOMER_DISSATISFACTION', description: 'Customer unhappy, cannot resell' },
    { reason_code: 'OTHER', description: 'Other (requires notes)' },
  ]);

  // 2. Create ReturnQueue
  await knex.schema.createTable('ReturnQueue', (table) => {
    table.uuid('queue_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.integer('owner_id').unsigned().references('id').inTable('employees');
    table.integer('created_by').unsigned().notNullable().references('id').inTable('employees');
    table.integer('approved_by').unsigned().references('id').inTable('employees');
    table.integer('committed_by').unsigned().references('id').inTable('employees');
    table.integer('queue_created_register_id').unsigned().references('id').inTable('registers');
    
    table.enum('queue_type', ['RECEIPT', 'UNRECEIPTED']).notNullable();
    table.enum('state', ['OPEN', 'SUBMITTED', 'APPROVED', 'COMMITTED', 'CANCELLED']).notNullable().defaultTo('OPEN');
    table.boolean('return_condition_verified').notNullable().defaultTo(false);
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 3. Create ReturnQueueItem
  await knex.schema.createTable('ReturnQueueItem', (table) => {
    table.uuid('item_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('queue_id').notNullable().references('queue_id').inTable('ReturnQueue').onDelete('CASCADE');
    table.integer('sku_id').unsigned().notNullable().references('id').inTable('products');
    
    table.decimal('quantity', 10, 2).notNullable();
    table.enum('disposition', ['RESTOCK', 'NON_RESTOCKABLE']).notNullable();
    table.string('non_restock_reason', 30).references('reason_code').inTable('NonRestockReason');
    
    table.uuid('original_sale_id').references('id').inTable('sales').onDelete('SET NULL');
    table.uuid('original_sale_line_id').references('id').inTable('sale_items').onDelete('SET NULL');
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Constraints
    table.unique(['queue_id', 'sku_id'], { indexName: 'idx_return_queue_item_unique' });
  });

  // 4. Add PL/pgSQL Trigger for Quantity Validation (P1 Issue #1 Fix)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION validate_return_queue_item()
    RETURNS TRIGGER AS $$
    DECLARE
      v_sold_qty DECIMAL;
      v_returned_qty DECIMAL;
    BEGIN
      -- Only validate if tied to an original sale line
      IF NEW.original_sale_line_id IS NOT NULL THEN
        
        -- Get original sold quantity
        SELECT quantity INTO v_sold_qty 
        FROM sale_items 
        WHERE id = NEW.original_sale_line_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Original sale line not found';
        END IF;

        -- Get previously committed returns for this sale line
        SELECT COALESCE(SUM(rqi.quantity), 0) INTO v_returned_qty
        FROM "ReturnQueueItem" rqi
        JOIN "ReturnQueue" rq ON rq.queue_id = rqi.queue_id
        WHERE rqi.original_sale_line_id = NEW.original_sale_line_id
          AND rq.state = 'COMMITTED'
          AND rqi.item_id != NEW.item_id;

        -- Check if new return exceeds remaining quantity
        IF (v_sold_qty - v_returned_qty) < NEW.quantity THEN
          RAISE EXCEPTION 'Return quantity exceeds originally sold quantity (Sold: %, Previously Returned: %, Requested: %)', 
            v_sold_qty, v_returned_qty, NEW.quantity;
        END IF;
      END IF;

      -- Validate non_restock_reason logic
      IF NEW.disposition = 'NON_RESTOCKABLE' AND NEW.non_restock_reason IS NULL THEN
        RAISE EXCEPTION 'non_restock_reason is required when disposition is NON_RESTOCKABLE';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`
    CREATE TRIGGER trg_validate_return_queue_item
    BEFORE INSERT OR UPDATE ON "ReturnQueueItem"
    FOR EACH ROW
    EXECUTE FUNCTION validate_return_queue_item();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TRIGGER IF EXISTS trg_validate_return_queue_item ON "ReturnQueueItem"');
  await knex.raw('DROP FUNCTION IF EXISTS validate_return_queue_item');
  await knex.schema.dropTableIfExists('ReturnQueueItem');
  await knex.schema.dropTableIfExists('ReturnQueue');
  await knex.schema.dropTableIfExists('NonRestockReason');
}
