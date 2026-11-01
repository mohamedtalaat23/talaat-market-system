import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add CHECK constraint for positive quantity
  await knex.raw('ALTER TABLE "ReturnQueueItem" ADD CONSTRAINT check_quantity_positive CHECK (quantity > 0)');

  // 2. Update trigger function to enforce SKU match
  await knex.raw(`
    CREATE OR REPLACE FUNCTION validate_return_queue_item()
    RETURNS TRIGGER AS $$
    DECLARE
      v_sold_qty DECIMAL;
      v_returned_qty DECIMAL;
      v_original_product_id INTEGER;
    BEGIN
      -- Only validate if tied to an original sale line
      IF NEW.original_sale_line_id IS NOT NULL THEN
        
        -- Get original sold quantity and product ID
        SELECT quantity, product_id INTO v_sold_qty, v_original_product_id 
        FROM sale_items 
        WHERE id = NEW.original_sale_line_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Original sale line not found';
        END IF;

        -- Prevent Cross-SKU Return Spoofing (P0 Fix)
        IF v_original_product_id != NEW.sku_id THEN
          RAISE EXCEPTION 'SKU ID mismatch: Returning product % does not match original sale line product %', NEW.sku_id, v_original_product_id;
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
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE "ReturnQueueItem" DROP CONSTRAINT IF EXISTS check_quantity_positive');
  
  // Revert function to original (without SKU check)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION validate_return_queue_item()
    RETURNS TRIGGER AS $$
    DECLARE
      v_sold_qty DECIMAL;
      v_returned_qty DECIMAL;
    BEGIN
      IF NEW.original_sale_line_id IS NOT NULL THEN
        SELECT quantity INTO v_sold_qty FROM sale_items WHERE id = NEW.original_sale_line_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Original sale line not found'; END IF;

        SELECT COALESCE(SUM(rqi.quantity), 0) INTO v_returned_qty
        FROM "ReturnQueueItem" rqi
        JOIN "ReturnQueue" rq ON rq.queue_id = rqi.queue_id
        WHERE rqi.original_sale_line_id = NEW.original_sale_line_id
          AND rq.state = 'COMMITTED'
          AND rqi.item_id != NEW.item_id;

        IF (v_sold_qty - v_returned_qty) < NEW.quantity THEN
          RAISE EXCEPTION 'Return quantity exceeds originally sold quantity (Sold: %, Previously Returned: %, Requested: %)', v_sold_qty, v_returned_qty, NEW.quantity;
        END IF;
      END IF;

      IF NEW.disposition = 'NON_RESTOCKABLE' AND NEW.non_restock_reason IS NULL THEN
        RAISE EXCEPTION 'non_restock_reason is required when disposition is NON_RESTOCKABLE';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}
