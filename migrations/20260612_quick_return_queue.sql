-- Revised Migration: QUICK RETURN QUEUE (2026-06-12)
-- This script incorporates the third round of hostile DBA review feedback.
--   • Enforced sale attribution consistency (either both null or both set).
--   • Removed vulnerable duplicate-scan upsert trigger (API will use native INSERT ... ON CONFLICT DO UPDATE).
--   • Added final commit-time over-return protection with row locking during the APPROVED -> COMMITTED transition.

BEGIN;

-- 1. NonRestockReason lookup table (7 approved codes)
CREATE TABLE "NonRestockReason" (
    reason_code VARCHAR(30) PRIMARY KEY,
    description TEXT NOT NULL
);
INSERT INTO "NonRestockReason" (reason_code, description) VALUES
    ('DAMAGED','Item physically damaged'),
    ('EXPIRED','Item past its sell-by date'),
    ('OPENED','Item opened by customer'),
    ('CONTAMINATED','Health-hazard contamination'),
    ('SUPPLIER_RECALL','Recall issued by supplier'),
    ('CUSTOMER_DISSATISFACTION','Customer not satisfied'),
    ('OTHER','Other reason not captured elsewhere')
ON CONFLICT (reason_code) DO NOTHING;

-- 2. ReturnQueue table
CREATE TABLE "ReturnQueue" (
    queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES "Employee"(employee_id),
    approved_by UUID REFERENCES "Employee"(employee_id),
    committed_by UUID REFERENCES "Employee"(employee_id),
    owner_id UUID NOT NULL REFERENCES "Employee"(employee_id),
    queue_created_register_id UUID NOT NULL REFERENCES "Register"(register_id),
    queue_type VARCHAR(20) NOT NULL CHECK (queue_type IN ('RECEIPT','UNRECEIPTED')),
    state VARCHAR(20) NOT NULL CHECK (state IN ('OPEN','SUBMITTED','APPROVED','COMMITTED','CANCELLED')),
    return_condition_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for quick look-ups
CREATE INDEX idx_returnqueue_register ON "ReturnQueue"(queue_created_register_id);
CREATE INDEX idx_returnqueue_owner ON "ReturnQueue"(owner_id);
CREATE INDEX idx_returnqueue_state ON "ReturnQueue"(state);

-- 3. ReturnQueueItem table
CREATE TABLE "ReturnQueueItem" (
    queue_id UUID NOT NULL REFERENCES "ReturnQueue"(queue_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    sku_id UUID NOT NULL REFERENCES "Product"(product_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    disposition VARCHAR(20) NOT NULL CHECK (disposition IN ('RESTOCK','NON_RESTOCKABLE')),
    non_restock_reason VARCHAR(30) REFERENCES "NonRestockReason"(reason_code),
    original_sale_id UUID REFERENCES "Sale"(sale_id),
    original_sale_line_id UUID REFERENCES "SaleLine"(sale_line_id),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (queue_id, line_number),
    UNIQUE (queue_id, sku_id),  -- ensures one line per SKU per queue (API will use ON CONFLICT DO UPDATE)
    CHECK (
        (original_sale_id IS NULL AND original_sale_line_id IS NULL)
     OR (original_sale_id IS NOT NULL AND original_sale_line_id IS NOT NULL)
    )
);

CREATE INDEX idx_returnqueueitem_sale_line ON "ReturnQueueItem"(original_sale_line_id);

-- 4. SystemSettings entries for queue aging thresholds
INSERT INTO "SystemSettings" (key, value) VALUES
    ('return_queue_warning_minutes','15'),
    ('return_queue_critical_minutes','30')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. Trigger: First-guard cumulative return quantity validation (at scan time)
CREATE OR REPLACE FUNCTION trg_check_cumulative_quantity()
RETURNS TRIGGER AS $$
DECLARE
    sold_qty INTEGER;
    returned_qty INTEGER;
BEGIN
    IF NEW.original_sale_line_id IS NOT NULL THEN
        -- No lock here; this is just a fast first guard for the UI
        SELECT sl.quantity INTO sold_qty 
        FROM "SaleLine" sl 
        WHERE sl.sale_line_id = NEW.original_sale_line_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Original sale line not found';
        END IF;

        -- Sum quantities already returned/pending for this sale line, excluding current row
        SELECT COALESCE(SUM(rqi.quantity), 0) INTO returned_qty
        FROM "ReturnQueueItem" rqi
        JOIN "ReturnQueue" rq ON rqi.queue_id = rq.queue_id
        WHERE rqi.original_sale_line_id = NEW.original_sale_line_id
          AND rq.state <> 'CANCELLED'
          AND NOT (rqi.queue_id = NEW.queue_id AND rqi.line_number = NEW.line_number);

        IF returned_qty + NEW.quantity > sold_qty THEN
            RAISE EXCEPTION 'Cumulative return quantity (%) exceeds sold quantity (%) for sale line %', returned_qty + NEW.quantity, sold_qty, NEW.original_sale_line_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chk_cumulative_quantity_before_insert_update
BEFORE INSERT OR UPDATE ON "ReturnQueueItem"
FOR EACH ROW EXECUTE FUNCTION trg_check_cumulative_quantity();

-- 6. Trigger: enforce non-restockable reason exists (explicit check)
CREATE OR REPLACE FUNCTION trg_check_non_restock_reason()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.disposition = 'NON_RESTOCKABLE' AND NEW.non_restock_reason IS NULL THEN
        RAISE EXCEPTION 'Non-restockable items must specify a valid reason code';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chk_non_restock_reason_before_insert
BEFORE INSERT OR UPDATE ON "ReturnQueueItem"
FOR EACH ROW EXECUTE FUNCTION trg_check_non_restock_reason();

-- 7. Trigger: strict state transition enforcement & final commit-time verification
CREATE OR REPLACE FUNCTION trg_enforce_state_transitions()
RETURNS TRIGGER AS $$
DECLARE
    item_rec RECORD;
    sold_qty INTEGER;
    committed_returned_qty INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.state = OLD.state THEN
            RETURN NEW; -- no state change, allow other column updates
        END IF;
        
        -- Allowed transitions
        IF OLD.state = 'OPEN' AND NEW.state = 'SUBMITTED' THEN
            RETURN NEW;
        ELSIF OLD.state = 'SUBMITTED' AND NEW.state = 'APPROVED' THEN
            IF NOT NEW.return_condition_verified THEN
                RAISE EXCEPTION 'Approval requires physical item verification (return_condition_verified = true)';
            END IF;
            IF NEW.approved_by IS NULL THEN
                RAISE EXCEPTION 'Approval requires approved_by attribution';
            END IF;
            RETURN NEW;
        ELSIF OLD.state = 'APPROVED' AND NEW.state = 'COMMITTED' THEN
            IF NOT NEW.return_condition_verified THEN
                RAISE EXCEPTION 'Commit requires physical item verification (return_condition_verified = true)';
            END IF;
            IF NEW.committed_by IS NULL THEN
                RAISE EXCEPTION 'Commit requires committed_by attribution';
            END IF;
            
            -- Final commit-time over-return protection with locking
            FOR item_rec IN SELECT * FROM "ReturnQueueItem" WHERE queue_id = NEW.queue_id LOOP
                IF item_rec.original_sale_line_id IS NOT NULL THEN
                    -- Lock the original sale line
                    SELECT sl.quantity INTO sold_qty 
                    FROM "SaleLine" sl 
                    WHERE sl.sale_line_id = item_rec.original_sale_line_id 
                    FOR UPDATE;
                    
                    -- Sum already COMMITTED quantities across all other queues
                    SELECT COALESCE(SUM(rqi.quantity), 0) INTO committed_returned_qty
                    FROM "ReturnQueueItem" rqi
                    JOIN "ReturnQueue" rq ON rqi.queue_id = rq.queue_id
                    WHERE rqi.original_sale_line_id = item_rec.original_sale_line_id
                      AND rq.state = 'COMMITTED'
                      AND rqi.queue_id <> NEW.queue_id;
                      
                    IF committed_returned_qty + item_rec.quantity > sold_qty THEN
                        RAISE EXCEPTION 'Commit failed: cumulative return quantity (%) exceeds sold quantity (%) for sale line %', 
                            committed_returned_qty + item_rec.quantity, sold_qty, item_rec.original_sale_line_id;
                    END IF;
                END IF;
            END LOOP;
            
            RETURN NEW;
        ELSIF OLD.state IN ('OPEN', 'SUBMITTED', 'APPROVED') AND NEW.state = 'CANCELLED' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Invalid state transition from % to %', OLD.state, NEW.state;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_state_transitions
BEFORE UPDATE ON "ReturnQueue"
FOR EACH ROW EXECUTE FUNCTION trg_enforce_state_transitions();

-- 8. View: ReturnQueue aging state with CTE for performance
CREATE OR REPLACE VIEW "ReturnQueueAgeState" AS
WITH thresholds AS (
    SELECT 
        COALESCE(MAX(CASE WHEN key = 'return_queue_warning_minutes' THEN value::INTEGER END), 15) AS warn_min,
        COALESCE(MAX(CASE WHEN key = 'return_queue_critical_minutes' THEN value::INTEGER END), 30) AS crit_min
    FROM "SystemSettings"
)
SELECT
    rq.queue_id,
    rq.created_at,
    EXTRACT(EPOCH FROM (now() - rq.created_at))/60 AS age_minutes,
    CASE
        WHEN EXTRACT(EPOCH FROM (now() - rq.created_at))/60 < t.warn_min THEN 'NORMAL'
        WHEN EXTRACT(EPOCH FROM (now() - rq.created_at))/60 < t.crit_min THEN 'WARNING'
        ELSE 'CRITICAL'
    END AS age_state
FROM "ReturnQueue" rq
CROSS JOIN thresholds t;

COMMIT;
