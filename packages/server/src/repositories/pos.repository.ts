import { db } from '../config/database';
import type { Knex } from 'knex';
import type { Product } from './product.repository';
import { customerRepository } from './customer.repository';
import { auditService } from '../services/audit.service';
import { allocateAcrossComponents, fromCents, toCents } from '../utils/money';
import {
  allocateRefundTenders,
  computeRefundLineAmount,
  computeSaleTotals,
  computeTenders,
  resolveRefundState,
  SaleMathError,
} from '../services/sale-math';

export interface RefundItemInput {
  sale_item_id: string;
  quantity: number;
  restock_inventory: boolean;
}

export interface RefundInput {
  payout_shift_id?: number;
  idempotency_key?: string;
  sale_id: string;
  manager_id: number;
  reason: string;
  items: RefundItemInput[];
  refund_type: 'full' | 'partial' | 'void';
}

export class InventoryUnderflowError extends Error {
  public code = 'INVENTORY_UNDERFLOW';
  public product_id: number;

  constructor(productId: number, message: string) {
    super(message);
    this.name = 'InventoryUnderflowError';
    this.product_id = productId;
  }
}

/**
 * Raised when an offline sale cannot be replayed without a manager decision
 * (price below catalogue, or a discount above the authorization threshold).
 *
 * The sale is *not* posted: it is written to `offline_sync_quarantine` so a
 * manager can review and approve it explicitly. Before this, tampered prices were
 * accepted and merely written to the audit log.
 */
export class OfflineApprovalRequiredError extends Error {
  public code: string;
  public reason: 'price_deviation' | 'discount_threshold';
  public product_id: number | null;

  constructor(
    code: 'OFFLINE_PRICE_APPROVAL_REQUIRED' | 'OFFLINE_DISCOUNT_APPROVAL_REQUIRED',
    message: string,
    reason: 'price_deviation' | 'discount_threshold',
    productId: number | null = null,
  ) {
    super(message);
    this.name = 'OfflineApprovalRequiredError';
    this.code = code;
    this.reason = reason;
    this.product_id = productId;
  }
}

export interface CheckoutItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
}

export interface CheckoutPayload {
  id?: string | undefined;
  receipt_number?: string | undefined;
  created_at?: string | undefined;
  shift_id: number;
  register_id: number;
  payment_method: 'cash' | 'card' | 'split' | 'debt';
  cash_received?: number | undefined;
  cash_amount?: number | undefined;
  card_amount?: number | undefined;
  idempotency_key: string;
  global_discount?: number | undefined;
  customer_id?: number | undefined;
  manager_pin?: string | undefined;
  manager_id?: number | undefined;
  items: CheckoutItem[];
}

export class POSRepository {
  /**
   * Open a new shift for the cashier.
   */
  async openShift(employeeId: number, startingCash: number, registerId: number = 1) {
    const [shift] = await db('cashier_shifts')
      .insert({
        employee_id: employeeId,
        register_id: registerId,
        status: 'open',
        starting_cash: startingCash,
      })
      .returning('*');
    return shift;
  }

  /**
   * Close a shift.
   */

  /**
   * Create a Cash Drawer Adjustment
   */
  async createDrawerAdjustment(payload: {
    shift_id: number;
    manager_id: number;
    type: string;
    amount: number;
    reason_code: string;
    reason_notes?: string;
  }) {
    return await db.transaction(async (trx) => {
      // Verify shift is open
      const shift = await trx('cashier_shifts')
        .where({ id: payload.shift_id, status: 'open' })
        .first();
      if (!shift) {
        throw new Error('Shift must be open to perform drawer adjustments.');
      }

      // Verify manager
      const manager = await trx('employees')
        .where({ id: payload.manager_id, role: 'manager' })
        .first();
      if (!manager) {
        throw new Error('Valid manager authorization is required for drawer adjustments.');
      }

      let direction = 'OUT';
      if (['change_replenishment'].includes(payload.type)) {
        direction = 'IN';
      } else if (payload.type === 'cash_correction') {
        // If cash_correction, we look at the reason_code. For simplicity, just use reason_code to denote direction or accept the type mapping.
        // Wait, if amount is always positive, how do we denote cash_correction direction?
        // Let's rely on reason_code or type. We can use 'cash_correction_in' and 'cash_correction_out' for the API type.
      }

      // Wait! The user's requested types are: safe_drop, change_replenishment, petty_cash, vendor_payment, owner_withdrawal, cash_correction.
      // If it's a cash_correction, let's look at the payload.type if we updated it, or we just rely on the controller logic.

      const inTypes = ['change_replenishment', 'cash_correction_in'];
      direction = inTypes.includes(payload.type) ? 'IN' : 'OUT';

      const [adj] = await trx('cash_drawer_adjustments')
        .insert({
          shift_id: payload.shift_id,
          cashier_id: shift.employee_id,
          manager_id: payload.manager_id,
          adjustment_type: direction,
          amount: payload.amount,
          reason_code: payload.reason_code,
          reason_notes: payload.reason_notes || null,
        })
        .returning('*');

      // Update shift expected cash
      if (direction === 'IN') {
        await trx('cashier_shifts')
          .where('id', shift.id)
          .update({
            expected_cash: trx.raw('expected_cash + ?', [payload.amount]),
            updated_at: trx.fn.now(),
          });
      } else {
        await trx('cashier_shifts')
          .where('id', shift.id)
          .update({
            expected_cash: trx.raw('expected_cash - ?', [payload.amount]),
            updated_at: trx.fn.now(),
          });
      }

      // Audit Log
      await trx('audit_logs').insert({
        entity_type: 'cash_drawer_adjustments',
        entity_id: String(adj.id),
        action: 'drawer_adjustment_created',
        old_value: null,
        new_value: JSON.stringify(adj),
        user_id: payload.manager_id,
        reason: payload.reason_notes || payload.reason_code,
      });

      return adj;
    });
  }

  async closeShift(
    shiftId: number,
    endingCash: number,
    expectedCash: number,
    notes: string | undefined,
    userId: number,
  ) {
    return db.transaction(async (trx) => {
      const current = await trx('cashier_shifts').where({ id: shiftId }).forUpdate().first();
      if (!current) throw new Error('Shift not found');
      if (current.status === 'closed') return current; // Safe network retry.
      const summary = await this.getShiftSummary(shiftId, trx);
      expectedCash = summary.expected_cash;
      const [shift] = await trx('cashier_shifts')
        .where({ id: shiftId })
        .update({
          status: 'closed',
          end_time: trx.fn.now(),
          ending_cash: endingCash,
          expected_cash: expectedCash,
          notes: notes || null,
          updated_at: trx.fn.now(),
        })
        .returning('*');
      await trx('audit_logs').insert({
        entity_type: 'cashier_shifts',
        entity_id: String(shift.id),
        action: 'shift_closed',
        old_value: null,
        new_value: JSON.stringify({
          ending_cash: endingCash,
          expected_cash: expectedCash,
          variance: fromCents(toCents(endingCash) - toCents(expectedCash)),
          notes,
        }),
        user_id: userId,
        reason: notes || 'Shift closed',
      });
      return shift;
    });
  }

  /**
   * Get the current active shift for a specific register (Drawer sharing).
   */
  async getCurrentShift(registerId: number) {
    return db('cashier_shifts').where({ register_id: registerId, status: 'open' }).first();
  }

  /**
   * Get the current active shift for a specific employee.
   */
  async getOpenShiftByEmployee(employeeId: number) {
    return db('cashier_shifts').where({ employee_id: employeeId, status: 'open' }).first();
  }

  /**
   * Get shift summary for closing
   */
  async getShiftSummary(shiftId: number, connection: Knex = db) {
    const shift = await connection('cashier_shifts').where('id', shiftId).first();
    if (!shift) throw new Error('Shift not found');

    const salesSummary = await connection('sales')
      .where('shift_id', shiftId)
      .whereIn('status', ['completed', 'partially_refunded', 'refunded', 'voided'])
      .select(
        connection.raw('COUNT(id) as transaction_count'),
        connection.raw('COALESCE(SUM(cash_paid), 0) as cash_sales'),
        connection.raw('COALESCE(SUM(card_paid), 0) as card_sales'),
        connection.raw(
          'COALESCE(SUM(COALESCE(discount_amount, 0) + COALESCE(global_discount, 0)), 0) as total_discounts',
        ),
        connection.raw(
          "COALESCE(SUM(CASE WHEN print_status = 'pending_print' THEN 1 ELSE 0 END), 0) as pending_prints",
        ),
      )
      .first();

    const refundsSummary = await connection('refunds')
      .join('sales', 'sales.id', 'refunds.sale_id')
      .where('refunds.shift_id', shiftId)
      .select(
        connection.raw('COALESCE(SUM(refunds.cash_refunded), 0) as cash_refunds'),
        connection.raw('COALESCE(SUM(refunds.card_refunded), 0) as card_refunds'),
      )
      .first();

    const adjustmentSummary = await connection('cash_drawer_adjustments')
      .where('shift_id', shiftId)
      .select(
        connection.raw(
          "COALESCE(SUM(CASE WHEN adjustment_type = 'IN' THEN amount ELSE 0 END), 0) as total_pay_ins",
        ),
        connection.raw(
          "COALESCE(SUM(CASE WHEN adjustment_type = 'OUT' THEN amount ELSE 0 END), 0) as total_pay_outs",
        ),
      )
      .first();

    const payIns = Number(adjustmentSummary?.total_pay_ins || 0);
    const payOuts = Number(adjustmentSummary?.total_pay_outs || 0);

    const paymentSummary = await connection('customer_transactions')
      .where('shift_id', shiftId)
      .andWhere('transaction_type', 'payment')
      .select(
        connection.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_payments",
        ),
        connection.raw(
          "COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card_payments",
        ),
      )
      .first();

    const cashSales =
      Number(salesSummary.cash_sales) +
      Number(paymentSummary.cash_payments) -
      Number(refundsSummary?.cash_refunds || 0) +
      payIns -
      payOuts;
    const cardSales =
      Number(salesSummary.card_sales) +
      Number(paymentSummary.card_payments) -
      Number(refundsSummary?.card_refunds || 0);
    const totalDiscounts = Number(salesSummary.total_discounts);
    const expectedCash = Number(shift.starting_cash) + cashSales;

    return {
      shift_id: shiftId,
      starting_cash: Number(shift.starting_cash),
      employee_id: shift.employee_id,
      cash_sales: cashSales,
      card_sales: cardSales,
      total_discounts: totalDiscounts,
      expected_cash: expectedCash,
      transaction_count: Number(salesSummary.transaction_count),
      pending_prints: Number(salesSummary.pending_prints),
      total_pay_ins: payIns,
      total_pay_outs: payOuts,
    };
  }

  /**
   * Atomic Checkout Transaction
   */
  async checkout(
    payload: CheckoutPayload,
    cashierId: number,
    bypassInventoryCheck: boolean = false,
    isOfflineSync: boolean = false,
    discountAuthorized: boolean = false,
    connection: Knex = db,
  ) {
    if (!payload.shift_id) {
      throw new Error('Active shift is required for checkout.');
    }

    try {
      return await connection.transaction(async (trx) => {
        // 1. Acquire transaction-level advisory lock on the hashed idempotency key to strictly serialize concurrent checkout requests
        const hashQuery = await trx.raw('SELECT hashtext(?) as hash', [payload.idempotency_key]);
        const lockHash = hashQuery.rows[0].hash;
        await trx.raw('SELECT pg_advisory_xact_lock(?)', [lockHash]);

        // 2. Perform a strict row-level lock check inside the serialized transaction block
        const existing = await trx('sales')
          .where('idempotency_key', payload.idempotency_key)
          .forUpdate()
          .first();

        if (existing) {
          if (existing.cashier_id !== cashierId)
            throw new Error('This checkout belongs to another employee.');
          const existingItems = await trx('sale_items').where('sale_id', existing.id);
          return { ...existing, items: existingItems };
        }

        // A rejected replay must never become a sale after catalogue changes or retries.
        const decision = await trx('offline_sync_quarantine')
          .where({ idempotency_key: payload.idempotency_key })
          .first();
        if (decision?.status === 'pending' && !discountAuthorized) {
          throw Object.assign(new Error('Offline sale requires manager review.'), {
            code: 'OFFLINE_REVIEW_REQUIRED',
          });
        }
        if (decision?.status === 'rejected') {
          if (decision.cashier_id !== cashierId)
            throw new Error('This checkout belongs to another employee.');
          throw Object.assign(
            new Error('Offline sale rejected; manager reconciliation required.'),
            {
              code: decision.reconciled_at ? 'OFFLINE_RECONCILED' : 'OFFLINE_REJECTED',
            },
          );
        }

        // Bind the drawer to the authenticated cashier, not client-supplied IDs.
        const shift = await trx('cashier_shifts')
          .where({ id: payload.shift_id })
          .forUpdate()
          .first();
        if (
          !shift ||
          shift.employee_id !== cashierId ||
          shift.register_id !== payload.register_id
        ) {
          throw new Error('Shift and register must belong to the authenticated cashier.');
        }
        if (!isOfflineSync && shift.status !== 'open')
          throw new Error('Shift must be open for checkout.');

        if (payload.payment_method === 'debt' && !payload.customer_id) {
          throw new Error('A customer must be selected to checkout using the debt payment method.');
        }

        // 1. Fetch products first to validate pricing and ensure consistent lock ordering
        // CRITICAL: Sort items by product_id ASC before acquiring row-level locks to prevent deadlocks.
        const sortedItems = [...payload.items].sort((a, b) => a.product_id - b.product_id);
        const productIds = sortedItems.map((item) => item.product_id);
        const products = await trx('products')
          .whereIn('id', productIds)
          .select('id', 'cost_price', 'selling_price', 'name', 'barcode');

        const productMap = new Map(products.map((p) => [p.id, p]));

        // 2. Re-price against the authoritative catalogue and total in cents.
        //
        // Offline replays are NOT authoritative for pricing: the catalogue price
        // is re-read on the server. If the offline unit price is *higher* than
        // the catalogue price the line is repriced downwards (the customer is
        // never overcharged) and the deviation is audited; if it is *lower* the
        // sale is only accepted with a manager override that the controller
        // verified. Otherwise the sale is rejected as `OFFLINE_PRICE_APPROVAL_REQUIRED`
        // and quarantined (never silently posted at the tampered price).
        const pricingItems: CheckoutItem[] = [];

        for (const item of sortedItems) {
          const product = productMap.get(item.product_id);
          if (!product) throw new Error(`Product ${item.product_id} not found`);

          const catalogueCents = toCents(product.selling_price);
          const submittedCents = toCents(item.unit_price);

          if (!isOfflineSync) {
            // Online checkout: strict price enforcement
            if (submittedCents !== catalogueCents) {
              throw new Error(
                `Price mismatch for ${product.name}. Expected ${product.selling_price}, got ${item.unit_price}. Please refresh the cart.`,
              );
            }
            pricingItems.push(item);
            continue;
          }

          if (submittedCents > catalogueCents) {
            await trx('audit_logs').insert({
              entity_type: 'sales',
              entity_id: payload.idempotency_key,
              action: 'offline_sync_price_reduced',
              old_value: String(item.unit_price),
              new_value: String(product.selling_price),
              user_id: cashierId,
              reason: `Offline unit_price above catalogue for product ${product.id}; repriced to catalogue`,
            });
            pricingItems.push({ ...item, unit_price: fromCents(catalogueCents) });
            continue;
          }

          if (submittedCents < catalogueCents) {
            if (!discountAuthorized) {
              throw new OfflineApprovalRequiredError(
                'OFFLINE_PRICE_APPROVAL_REQUIRED',
                `Offline sale price for product ${item.product_id} (${fromCents(
                  submittedCents,
                ).toFixed(2)}) is below the catalogue price (${fromCents(catalogueCents).toFixed(
                  2,
                )}) and no manager approval was provided.`,
                'price_deviation',
                item.product_id,
              );
            }
            await trx('audit_logs').insert({
              entity_type: 'sales',
              entity_id: payload.idempotency_key,
              action: 'offline_sync_price_override_approved',
              old_value: String(product.selling_price),
              new_value: String(item.unit_price),
              user_id: cashierId,
              reason: `Offline unit_price below catalogue for product ${product.id}, authorised by manager PIN`,
            });
          }

          pricingItems.push(item);
        }

        const totals = computeSaleTotals({
          items: pricingItems,
          globalDiscount: payload.global_discount ?? 0,
        });

        // `discountAuthorized` is only true when a manager PIN was verified by the
        // controller. A client-supplied `manager_id` alone is NOT proof of approval.
        if (totals.requiresDiscountApproval && !discountAuthorized) {
          if (isOfflineSync) {
            throw new OfflineApprovalRequiredError(
              'OFFLINE_DISCOUNT_APPROVAL_REQUIRED',
              'Offline sale contains a discount above the authorized threshold and no manager approval was provided.',
              'discount_threshold',
            );
          }
          throw new SaleMathError(
            'DISCOUNT_NOT_AUTHORIZED',
            'Manager authorization required for discounts exceeding 20%',
          );
        }

        const tenders = computeTenders({
          method: payload.payment_method,
          totalCents: totals.totalCents,
          cashReceived: payload.cash_received,
          cashAmount: payload.cash_amount,
          cardAmount: payload.card_amount,
        });

        const subtotal = fromCents(totals.subtotalCents);
        const discountAmount = fromCents(totals.lineDiscountCents);
        const globalDiscount = fromCents(totals.globalDiscountCents);
        const taxAmount = fromCents(totals.taxCents);
        const total = fromCents(totals.totalCents);
        const changeGiven = fromCents(tenders.changeCents);
        const cashPaid = fromCents(tenders.cashPaidCents);
        const cardPaid = fromCents(tenders.cardPaidCents);
        const debtPaid = fromCents(tenders.debtPaidCents);

        // 2. Generate Receipt Number using sequence
        const { rows } = await trx.raw(`SELECT nextval('receipt_number_seq') as seq`);
        const seq = String(rows[0].seq).padStart(5, '0');
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const receiptNumber = `STR01-REG${String(payload.register_id || 1).padStart(2, '0')}-${dateStr}-${seq}`;

        // 3. Create Sale Record
        const [sale] = await trx('sales')
          .insert({
            id: payload.id || trx.raw('gen_random_uuid()'),
            receipt_number: receiptNumber,
            cashier_id: cashierId,
            shift_id: payload.shift_id,
            register_id: payload.register_id,
            payment_method: payload.payment_method,
            subtotal,
            discount_amount: discountAmount,
            global_discount: globalDiscount,
            tax_amount: taxAmount,
            total,
            cash_received:
              payload.payment_method === 'cash' && tenders.cashTenderedCents !== null
                ? fromCents(tenders.cashTenderedCents)
                : null,
            cash_amount:
              payload.payment_method === 'split' && tenders.cashTenderedCents !== null
                ? fromCents(tenders.cashTenderedCents)
                : null,
            card_amount:
              payload.payment_method === 'split' && tenders.cardTenderedCents !== null
                ? fromCents(tenders.cardTenderedCents)
                : null,
            change_given: changeGiven,
            cash_paid: cashPaid,
            card_paid: cardPaid,
            debt_paid: debtPaid,
            status: 'completed',
            print_status: 'pending_print',
            print_count: 0,
            idempotency_key: payload.idempotency_key,
            customer_id: payload.customer_id || null,
          })
          .returning('*');

        if (bypassInventoryCheck && payload.manager_id) {
          await trx('manager_overrides').insert({
            manager_id: payload.manager_id,
            cashier_id: cashierId,
            action_type: 'inventory_bypass',
            reference_id: sale.id,
            details: `Inventory bypass for checkout ${receiptNumber}`,
          });
        }

        if (payload.payment_method === 'debt' && payload.customer_id) {
          const customer = await trx('customers')
            .where('id', payload.customer_id)
            .whereNull('deleted_at')
            .forUpdate()
            .first();
          if (!customer) {
            throw new Error('Selected customer not found or has been deleted.');
          }

          await trx('customer_transactions').insert({
            customer_id: payload.customer_id,
            transaction_type: 'sale',
            amount: -total,
            reference_id: receiptNumber,
            notes: `POS credit sale checkout: ${receiptNumber}`,
            created_by: cashierId,
            created_at: trx.fn.now(),
          });

          await trx('customers')
            .where('id', payload.customer_id)
            .update({
              balance: trx.raw('balance - ?', [total]),
              updated_at: trx.fn.now(),
            });
        }

        // 4. Process items and inventory
        // (Prices are validated above and sorted by product_id for lock ordering;
        // line totals come from the cent-exact `totals.lines` array.)
        const saleItemsToInsert = [];

        for (const [index, item] of sortedItems.entries()) {
          const product = productMap.get(item.product_id)!;
          const computedLine = totals.lines[index]!;

          if (!product) {
            throw new Error(`Product ${item.product_id} disappeared during checkout.`);
          }

          saleItemsToInsert.push({
            sale_id: sale.id,
            product_id: item.product_id,
            product_name: product.name,
            barcode: product.barcode,
            quantity: item.quantity,
            unit_price: fromCents(computedLine.unitPriceCents),
            discount: fromCents(computedLine.discountCents),
            line_total: fromCents(computedLine.lineTotalCents),
            cost_at_sale: product.cost_price || 0,
          });

          let affectedRows = 0;

          if (bypassInventoryCheck) {
            // Bypasses the inventory check constraint logic, allowing stock count to temporarily go negative
            affectedRows = await trx('inventory')
              .where('product_id', item.product_id)
              .decrement('quantity', item.quantity);

            if (affectedRows === 0) {
              await trx('inventory').insert({
                product_id: item.product_id,
                quantity: -item.quantity,
                reserved_quantity: 0,
              });
              affectedRows = 1;
            }
          } else {
            // Enforces strict inventory underflow guard using atomic condition checks
            affectedRows = await trx('inventory')
              .where('product_id', item.product_id)
              .andWhere('quantity', '>=', item.quantity)
              .decrement('quantity', item.quantity);
          }

          if (affectedRows === 0) {
            throw new InventoryUnderflowError(
              item.product_id,
              `Insufficient inventory or inventory record missing for product ID ${item.product_id}. Checkout aborted.`,
            );
          }
        }

        const insertedItems = await trx('sale_items').insert(saleItemsToInsert).returning('*');

        // Update live shift tracker with incoming cash
        if (cashPaid > 0 && payload.shift_id) {
          await trx('cashier_shifts')
            .where('id', payload.shift_id)
            .update({
              expected_cash: trx.raw('expected_cash + ?', [cashPaid]),
              updated_at: trx.fn.now(),
            });
        }

        return { ...sale, items: insertedItems };
      });
    } catch (error: any) {
      if (error.code === '23505' && error.message?.includes('idempotency_key')) {
        // Race condition: another request just inserted this idempotency key.
        const existing = await db('sales')
          .where('idempotency_key', payload.idempotency_key)
          .first();
        if (existing) {
          const existingItems = await db('sale_items').where('sale_id', existing.id);
          return { ...existing, items: existingItems };
        }
      }
      throw error;
    }
  }

  /**
   * Idempotent, Fault-Isolated Batch Sync for Offline Transactions.
   *
   * Each sale is processed in its own transaction via checkout() so that
   * a single poison sale (deleted customer, missing product) does not
   * roll back the entire batch. The caller receives a breakdown of
   * which IDs succeeded and which failed.
   */
  async syncOffline(payloads: CheckoutPayload[], cashierId: number, managerAuthorized = false) {
    if (payloads.length === 0) {
      return {
        synced: 0,
        syncedIds: [] as string[],
        failed: [] as { id: string; error: string; code?: string; quarantined?: boolean }[],
      };
    }

    // 1. Preemptive Idempotency Check: skip sales that already exist in DB
    const incomingIds = payloads.map((p) => p.id).filter(Boolean) as string[];
    const incomingKeys = payloads.map((p) => p.idempotency_key).filter(Boolean);

    const existingSales = await db('sales')
      .where(function () {
        if (incomingIds.length > 0) this.whereIn('id', incomingIds);
        if (incomingKeys.length > 0) this.orWhereIn('idempotency_key', incomingKeys);
      })
      .where('cashier_id', cashierId)
      .select('id', 'idempotency_key');

    const existingIdsSet = new Set(existingSales.map((s) => s.id));
    const existingKeysSet = new Set(existingSales.map((s) => s.idempotency_key));

    // Filter out already-synchronized sales completely before doing any operations
    const salesToProcess = payloads.filter((p) => {
      const hasId = p.id && existingIdsSet.has(p.id);
      const hasKey = p.idempotency_key && existingKeysSet.has(p.idempotency_key);
      return !hasId && !hasKey;
    });

    const acknowledgedIds = payloads
      .filter((p) => !salesToProcess.includes(p))
      .map((p) => p.id || p.idempotency_key);

    if (salesToProcess.length === 0) {
      return {
        synced: 0,
        syncedIds: acknowledgedIds,
        failed: [] as { id: string; error: string; code?: string; quarantined?: boolean }[],
      };
    }

    // 2. Sort sales by their minimum product_id to maintain consistent lock ordering
    const sortedSales = [...salesToProcess].sort((a, b) => {
      const aMin = a.items.length > 0 ? Math.min(...a.items.map((i) => i.product_id)) : 0;
      const bMin = b.items.length > 0 ? Math.min(...b.items.map((i) => i.product_id)) : 0;
      return aMin - bMin;
    });

    // 3. Process each sale in its own isolated transaction
    const syncedIds: string[] = [...acknowledgedIds];
    const failed: { id: string; error: string; code?: string; quarantined?: boolean }[] = [];

    const reconciledIds: string[] = [];
    for (const payload of sortedSales) {
      const saleIdentifier = payload.id || payload.idempotency_key;
      try {
        // Offline sales bypass inventory underflow checks since the physical sale already happened
        await this.checkout(payload, cashierId, true, true, managerAuthorized);
        syncedIds.push(saleIdentifier);
      } catch (error: any) {
        console.error(`[SyncOffline] Failed to sync sale ${saleIdentifier}:`, error.message);

        if (error.code === 'OFFLINE_RECONCILED') {
          reconciledIds.push(saleIdentifier);
          continue;
        }
        if (error.code === 'OFFLINE_REVIEW_REQUIRED') {
          failed.push({
            id: saleIdentifier,
            error: error.message,
            code: error.code,
            quarantined: true,
          });
          continue;
        }
        if (error.code === 'OFFLINE_REJECTED') {
          failed.push({ id: saleIdentifier, error: error.message, code: error.code });
          continue;
        }

        if (error instanceof OfflineApprovalRequiredError) {
          // A tampered/lower price or an unauthorised discount is never posted
          // silently: it is parked for an explicit manager decision.
          await this.quarantineOfflineSale(payload, cashierId, error);
          failed.push({
            id: saleIdentifier,
            error: error.message,
            code: error.code,
            quarantined: true,
          });
          continue;
        }

        failed.push({
          id: saleIdentifier,
          error: error.message || 'Unknown sync error',
        });
      }
    }

    return {
      synced: syncedIds.length - acknowledgedIds.length,
      syncedIds,
      failed,
      ...(reconciledIds.length ? { reconciledIds } : {}),
    };
  }

  /**
   * Persists an offline sale that requires manager approval. Idempotent: replaying
   * the same sale updates the quarantine reason instead of duplicating the row.
   */
  async quarantineOfflineSale(
    payload: CheckoutPayload,
    cashierId: number,
    error: OfflineApprovalRequiredError,
  ) {
    await db('offline_sync_quarantine')
      .insert({
        idempotency_key: payload.idempotency_key,
        sale_id: payload.id ?? null,
        cashier_id: cashierId,
        reason: error.reason,
        product_id: error.product_id,
        detail: error.message,
        payload: JSON.stringify(payload),
        status: 'pending',
        created_at: db.fn.now(),
      })
      .onConflict('idempotency_key')
      .ignore(); // Keep the first submitted evidence immutable across retries.
  }

  /** Lists offline sales awaiting manager approval (oldest first). */
  async listQuarantinedSales(status: 'pending' | 'approved' | 'rejected' = 'pending') {
    const query = db('offline_sync_quarantine').where({ status });
    // Keep unresolved rejections visible even after a long history of reconciled entries.
    if (status === 'rejected') query.orderBy('reconciled_at', 'asc', 'first');
    return query.orderBy('created_at', 'asc').limit(100);
  }

  /**
   * Resolves a quarantined offline sale.
   *
   * `approve` re-runs the original checkout with `discountAuthorized = true`
   * (a manager PIN must already have been verified by the controller). Rejecting
   * marks the row rejected and leaves it on record — nothing is deleted.
   */
  async resolveQuarantinedSale(
    id: number,
    decision: 'approve' | 'reject' | 'reconcile',
    managerId: number,
    notes?: string,
  ) {
    return db.transaction(async (trx) => {
      const initial = await trx('offline_sync_quarantine').where({ id }).first();
      if (!initial) throw new Error('Quarantined sale not found.');
      // Match checkout lock order so approval and replay cannot race or deadlock.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [initial.idempotency_key]);
      const row = await trx('offline_sync_quarantine').where({ id }).forUpdate().first();
      if (!row) throw new Error('Quarantined sale not found.');
      if (decision === 'reconcile') {
        if (row.status !== 'rejected') throw new Error('Only rejected sales can be reconciled.');
        if (!notes || notes.trim().length < 10)
          throw new Error('Reconciliation notes are required.');
        if (row.reconciled_at) return { status: 'reconciled', sale: null };
        await trx('offline_sync_quarantine').where({ id }).update({
          reconciled_at: trx.fn.now(),
          reconciled_by: managerId,
          reconciliation_notes: notes.trim(),
        });
        await trx('audit_logs').insert({
          entity_type: 'offline_sync_quarantine',
          entity_id: String(id),
          action: 'offline_sale_reconciled',
          user_id: managerId,
          new_value: JSON.stringify({ status: 'reconciled', sale_id: null }),
          reason: notes.trim(),
        });
        return { status: 'reconciled', sale: null };
      }
      if (row.status !== 'pending') throw new Error(`Quarantined sale is already ${row.status}.`);
      const payload: CheckoutPayload =
        typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const sale =
        decision === 'approve'
          ? await this.checkout(payload, row.cashier_id, true, true, true, trx)
          : null;
      const status = decision === 'approve' ? 'approved' : 'rejected';
      await trx('offline_sync_quarantine')
        .where({ id })
        .update({
          status,
          resolved_by: managerId,
          resolved_at: trx.fn.now(),
          resolution_notes: notes ?? null,
        });
      await trx('audit_logs').insert({
        entity_type: 'offline_sync_quarantine',
        entity_id: String(id),
        action: `offline_sale_${status}`,
        user_id: managerId,
        new_value: JSON.stringify({ status, sale_id: sale?.id }),
        reason: notes || 'Manager offline sale decision',
      });
      return { status, sale };
    });
  }

  /**
   * Mark receipt as printed successfully
   */
  async markReceiptPrinted(saleId: string) {
    const [sale] = await db('sales')
      .where('id', saleId)
      .update({
        print_status: 'printed',
        print_count: db.raw('print_count + 1'),
        updated_at: db.fn.now(),
      })
      .returning('*');
    return sale;
  }

  /**
   * Reprint an old receipt
   */
  async reprintReceipt(saleId: string, managerId: number) {
    return db.transaction(async (trx) => {
      const [sale] = await trx('sales')
        .where('id', saleId)
        .update({
          print_status: 'printed',
          print_count: db.raw('print_count + 1'),
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!sale) throw new Error('Sale not found');

      await trx('manager_overrides').insert({
        manager_id: managerId,
        cashier_id: sale.cashier_id,
        action_type: 'reprint_receipt',
        reference_id: saleId,
        details: `Reprint #${sale.print_count} for receipt ${sale.receipt_number}`,
      });

      const items = await trx('sale_items').where('sale_id', saleId);
      return { ...sale, items };
    });
  }

  /**
   * Search for sales by receipt number or date
   */
  async searchSales(query: string, limit: number = 20) {
    const q = db('sales')
      .select('sales.*', 'employees.username as cashier_name')
      .leftJoin('employees', 'sales.cashier_id', 'employees.id')
      .orderBy('sales.created_at', 'desc')
      .limit(limit);

    if (query) {
      // Escape ILIKE wildcard characters (\, %, _) to avoid index-bypassing scans
      const escapedQuery = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      q.where('receipt_number', 'ilike', `%${escapedQuery}%`);
    }

    const sales = await q;

    if (sales.length > 0) {
      const saleIds = sales.map((s) => s.id);
      const items = await db('sale_items').whereIn('sale_id', saleIds);

      const itemsBySaleId = items.reduce(
        (acc, item) => {
          if (!acc[item.sale_id]) acc[item.sale_id] = [];
          acc[item.sale_id].push(item);
          return acc;
        },
        {} as Record<string, any[]>,
      );

      for (const sale of sales) {
        sale.items = itemsBySaleId[sale.id] || [];
      }
    }

    return sales;
  }

  /**
   * Get a single receipt by ID with all details
   */
  async getReceiptById(saleId: string) {
    const sale = await db('sales')
      .select('sales.*', 'employees.username as cashier_name')
      .leftJoin('employees', 'sales.cashier_id', 'employees.id')
      .where('sales.id', saleId)
      .first();

    if (!sale) return null;

    const items = await db('sale_items').where('sale_id', saleId);
    sale.items = items;

    return sale;
  }
  /**
   * Lightweight POS product search — returns top-N matches WITHOUT a COUNT(*) query.
   *
   * This is intentionally leaner than ProductRepository.findAll():
   *   - No category/supplier join (not needed at POS point of scan)
   *   - No total count query (cashier only needs the top results)
   *   - Minimum 2-character query enforced upstream by the validator
   *
   * Use this endpoint for the POS search fallback modal while the cashier types.
   * Use GET /products for the admin catalog with full pagination metadata.
   */
  async searchProducts(search: string, limit: number): Promise<Product[]> {
    const escapedSearch = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchPattern = `%${escapedSearch}%`;
    const rows = await db('products')
      .leftJoin('inventory', 'inventory.product_id', 'products.id')
      .leftJoin('categories', 'categories.id', 'products.category_id')
      .select(
        'products.*',
        'categories.name as category_name',
        'categories.name_ar as category_name_ar',
        'inventory.quantity as inventory_quantity',
        'inventory.reserved_quantity as inventory_reserved_quantity',
      )
      .whereNull('products.deleted_at')
      .where('products.is_active', true)
      .where((builder) => {
        builder
          .where('products.name', 'ILIKE', searchPattern)
          .orWhere('products.name_ar', 'ILIKE', searchPattern)
          .orWhere('products.barcode', 'ILIKE', searchPattern);
      })
      .orderBy('products.name', 'asc')
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      cost_price: Number(row.cost_price),
      selling_price: Number(row.selling_price),
      min_stock_level: Number(row.min_stock_level),
      max_stock_level: Number(row.max_stock_level),
      inventory_quantity:
        row.inventory_quantity !== null ? Number(row.inventory_quantity) : undefined,
      inventory_reserved_quantity:
        row.inventory_reserved_quantity !== null
          ? Number(row.inventory_reserved_quantity)
          : undefined,
    })) as Product[];
  }

  async processRefund(input: RefundInput) {
    return db.transaction(async (trx) => {
      // 1. Lock sales row
      const sale = await trx('sales').where('id', input.sale_id).forUpdate().first();
      if (!sale) throw new Error('Sale not found');
      if (input.idempotency_key) {
        const existing = await trx('refunds')
          .where({ sale_id: sale.id, idempotency_key: input.idempotency_key })
          .first();
        if (existing)
          return {
            refund_id: existing.id,
            refund_receipt_number: existing.refund_receipt_number,
            total_refunded: Number(existing.total_refunded),
            status: sale.status,
          };
      }
      if (sale.status === 'voided') throw new Error('Sale is already voided');

      const payoutShiftId = input.payout_shift_id ?? sale.shift_id;
      const payoutShift = await trx('cashier_shifts')
        .where({ id: payoutShiftId, status: 'open' })
        .forUpdate()
        .first();
      if (!payoutShift) throw new Error('An open payout shift is required for refunds.');

      const originalSaleTotal = Number(sale.total);
      const alreadyRefundedAmount = Number(sale.refunded_amount);

      if (new Set(input.items.map((item) => item.sale_item_id)).size !== input.items.length) {
        throw new Error('Duplicate refund lines are not allowed.');
      }
      // Lock all receipt lines in stable order, then distribute the amount
      // actually paid (including the cart discount) across the whole receipt.
      const saleItems = await trx('sale_items')
        .where('sale_id', input.sale_id)
        .orderBy('id', 'asc')
        .forUpdate();
      const refundable = allocateAcrossComponents(
        saleItems.map((item) => toCents(item.line_total)),
        0,
        toCents(sale.total),
      );
      const netLineTotals = new Map(saleItems.map((item, index) => [item.id, refundable[index]!]));
      const saleItemsMap = new Map(saleItems.map((item) => [item.id, item]));

      // Sort items by product_id ASC to ensure consistent inventory lock ordering
      const sortedRefundItems = [...input.items].sort((a, b) => {
        const itemA = saleItemsMap.get(a.sale_item_id);
        const itemB = saleItemsMap.get(b.sale_item_id);
        return (itemA?.product_id || 0) - (itemB?.product_id || 0);
      });

      let totalRefundCents = 0;
      const refundItemsToInsert = [];

      // Process each item in sorted order to prevent deadlocks
      for (const reqItem of sortedRefundItems) {
        const dbItem = saleItemsMap.get(reqItem.sale_item_id);
        if (!dbItem) throw new Error(`Sale item ${reqItem.sale_item_id} not found on this receipt`);

        const availableQty = Number(dbItem.quantity) - Number(dbItem.refunded_quantity);
        if (reqItem.quantity > availableQty) {
          throw new Error(
            `Cannot refund ${reqItem.quantity} of item. Only ${availableQty} available.`,
          );
        }

        // Cumulative (not per-unit) allocation, so refunding a 10.00 line of
        // three units in three steps returns exactly 10.00 — never 9.99.
        const itemRefundCents = computeRefundLineAmount({
          lineTotalCents: netLineTotals.get(dbItem.id)!,
          saleQuantity: Number(dbItem.quantity),
          alreadyRefundedQuantity: Number(dbItem.refunded_quantity),
          refundQuantity: reqItem.quantity,
        });
        totalRefundCents += itemRefundCents;

        refundItemsToInsert.push({
          sale_item_id: dbItem.id,
          product_id: dbItem.product_id,
          quantity_refunded: reqItem.quantity,
          refund_amount: fromCents(itemRefundCents),
          restock_inventory: reqItem.restock_inventory,
        });

        // Update sale_items aggregate
        await trx('sale_items')
          .where('id', dbItem.id)
          .increment('refunded_quantity', reqItem.quantity)
          .update({ updated_at: trx.fn.now() });

        // Handle Inventory Restock
        if (reqItem.restock_inventory) {
          await trx('inventory')
            .where('product_id', dbItem.product_id)
            .increment('quantity', reqItem.quantity)
            .update({ updated_at: trx.fn.now() });
          await trx('inventory_adjustments').insert({
            product_id: dbItem.product_id,
            adjustment_type: 'return',
            quantity_change: reqItem.quantity,
            new_quantity: 0,
            old_quantity: 0,
            notes: `Refund restock for sale ${sale.receipt_number}`,
            created_by: input.manager_id,
          });
        } else {
          await trx('inventory_adjustments').insert({
            product_id: dbItem.product_id,
            adjustment_type: 'damage',
            quantity_change: 0,
            new_quantity: 0,
            old_quantity: 0,
            notes: `Damaged return for sale ${sale.receipt_number}`,
            created_by: input.manager_id,
          });
        }
      }

      // Protect against monetary over-refund (exact integer comparison — the old
      // implementation allowed an extra cent through a `+ 0.01` epsilon).
      const saleTotalCents = toCents(sale.total);
      const alreadyRefundedCents = toCents(sale.refunded_amount);
      const { status: refundStatus } = resolveRefundState(
        saleTotalCents,
        alreadyRefundedCents,
        totalRefundCents,
      );

      // 3. Allocate the refund across the original tenders proportionally, with
      // no cent lost or created (cash/card/debt shares always sum to the refund).
      const history = await trx('refunds')
        .where({ sale_id: sale.id })
        .select(
          trx.raw('COALESCE(SUM(cash_refunded), 0) AS cash'),
          trx.raw('COALESCE(SUM(card_refunded), 0) AS card'),
          trx.raw('COALESCE(SUM(debt_reversed), 0) AS debt'),
        )
        .first();
      const tenderAllocation = allocateRefundTenders({
        saleTotalCents,
        refundedComponentsCents: [
          toCents(history.cash),
          toCents(history.card),
          toCents(history.debt),
        ],
        cashPaidCents: toCents(sale.cash_paid),
        cardPaidCents: toCents(sale.card_paid),
        debtPaidCents: toCents(sale.debt_paid),
        alreadyRefundedCents,
        refundCents: totalRefundCents,
      });

      const totalRefundAmount = fromCents(totalRefundCents);
      const cashRefunded = fromCents(tenderAllocation.cashCents);
      const cardRefunded = fromCents(tenderAllocation.cardCents);
      const debtReversed = fromCents(tenderAllocation.debtCents);

      // Insert refund record
      const rawResult = await trx.raw(`SELECT nextval('refund_receipt_number_seq') as seq`);
      const refundReceiptNum = rawResult.rows[0];
      const formattedRefundReceipt = `RF-${new Date().getFullYear()}-${String(refundReceiptNum.seq).padStart(6, '0')}`;

      const [refund] = await trx('refunds')
        .insert({
          sale_id: sale.id,
          refund_receipt_number: formattedRefundReceipt,
          idempotency_key: input.idempotency_key ?? null,
          manager_id: input.manager_id,
          shift_id: payoutShiftId,
          refund_type: input.refund_type,
          original_sale_total: originalSaleTotal,
          total_refunded: totalRefundAmount,
          cash_refunded: cashRefunded,
          card_refunded: cardRefunded,
          debt_reversed: debtReversed,
          reason: input.reason,
          status: 'completed',
        })
        .returning('*');

      const mappedRefundItems = refundItemsToInsert.map((ri) => ({
        ...ri,
        refund_id: refund.id,
      }));

      await trx('refund_items').insert(mappedRefundItems);

      // Increment aggregated refund on sale
      await trx('sales')
        .where('id', sale.id)
        .increment('refunded_amount', totalRefundAmount)
        .update({ updated_at: trx.fn.now() });

      // Deduct cash from shift if applicable
      if (cashRefunded > 0 && payoutShiftId) {
        await trx('cashier_shifts')
          .where('id', payoutShiftId)
          .decrement('expected_cash', cashRefunded)
          .update({ updated_at: trx.fn.now() });
      }

      // Reverse customer debt if applicable
      if (debtReversed > 0 && sale.customer_id) {
        await customerRepository.recordTransaction(
          sale.customer_id,
          debtReversed, // Positive amount to credit their balance back (reduce debt)
          'adjustment',
          formattedRefundReceipt,
          `Refund for sale ${sale.receipt_number}`,
          input.manager_id,
          payoutShiftId,
          payoutShift.register_id,
          'cash',
          trx,
        );
      }

      // Update Sales status state machine
      let newStatus: string = sale.status;
      if (input.refund_type === 'void') {
        newStatus = 'voided';
      } else {
        // Cent-exact comparison: no epsilon, no premature "fully refunded" state.
        newStatus = refundStatus;
      }

      if (newStatus !== sale.status) {
        await trx('sales')
          .where('id', sale.id)
          .update({ status: newStatus, updated_at: trx.fn.now() });
      }

      // Audit Logging
      await auditService.logEvent({
        entityType: 'sales',
        entityId: sale.id,
        action: input.refund_type === 'void' ? 'sale_voided' : 'sale_refunded',
        oldValue: { status: sale.status, refunded_amount: alreadyRefundedAmount, sale_id: sale.id },
        newValue: {
          status: newStatus,
          refunded_amount: alreadyRefundedAmount + totalRefundAmount,
          refund_receipt: formattedRefundReceipt,
          sale_id: sale.id,
        },
        userId: input.manager_id,
        reason: input.reason,
        trx: trx,
      });

      return {
        refund_id: refund.id,
        refund_receipt_number: formattedRefundReceipt,
        total_refunded: totalRefundAmount,
        status: newStatus,
      };
    });
  }
}

export const posRepository = new POSRepository();
