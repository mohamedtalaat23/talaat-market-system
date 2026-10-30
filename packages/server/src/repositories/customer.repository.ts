import { db } from '../config/database';
import type { Knex } from 'knex';
import { fromCents, toCents } from '../utils/money';

/**
 * Payment-accounting failures carry a machine-readable code so controllers can
 * map them to 400/409 responses instead of leaking a generic 500.
 */
export class CustomerPaymentError extends Error {
  public code:
    'AMOUNT_INVALID' | 'NO_OUTSTANDING_BALANCE' | 'PAYMENT_EXCEEDS_BALANCE' | 'SHIFT_NOT_OPEN';

  constructor(code: CustomerPaymentError['code'], message: string) {
    super(message);
    this.name = 'CustomerPaymentError';
    this.code = code;
  }
}

export interface RecordPaymentInput {
  customerId: number;
  /** Decimal amount as entered by the cashier. */
  amount: number;
  paymentMethod: 'cash' | 'card';
  notes?: string | null;
  userId: number | null;
  shiftId: number | null;
  registerId: number | null;
  /** Client-generated key so a retried request cannot post twice. */
  idempotencyKey?: string | null;
}

export interface RecordPaymentResult {
  customer: Customer;
  duplicate: boolean;
  appliedAmount: number;
  outstandingBefore: number;
  outstandingAfter: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: number;
  loyalty_points: number;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CustomerTransaction {
  id: number;
  customer_id: number;
  transaction_type: 'sale' | 'payment' | 'adjustment';
  amount: number;
  reference_id: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: Date;
  shift_id?: number | null;
  register_id?: number | null;
  payment_method?: 'cash' | 'card';
  // Joined field
  created_by_name?: string | null;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
  notes?: string | null | undefined;
  balance?: number | undefined;
  loyalty_points?: number | undefined;
}

export interface UpdateCustomerInput {
  name?: string | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  address?: string | null | undefined;
  notes?: string | null | undefined;
  loyalty_points?: number | undefined;
}

export class CustomerRepository {
  /**
   * List all customers (excluding soft-deleted ones by default) with optional text search and pagination.
   */
  async findAll(
    search?: string,
    limit = 50,
    offset = 0,
    sortBy: string = 'name',
    sortOrder: 'asc' | 'desc' = 'asc',
  ): Promise<{ data: Customer[]; total: number }> {
    let query = db('customers').whereNull('deleted_at');

    if (search) {
      const escapedSearch = search
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      query = query.andWhere((builder) => {
        builder
          .where('name', 'ilike', `%${escapedSearch}%`)
          .orWhere('phone', 'like', `%${escapedSearch}%`);
      });
    }

    let sortField = 'name';
    switch (sortBy) {
      case 'balance':
        sortField = 'balance';
        break;
      case 'lastActivity':
        sortField = 'updated_at';
        break;
      case 'name':
      default:
        sortField = 'name';
    }

    const countQuery = query.clone().clearSelect().count('* as count').first();
    const dataQuery = query.orderBy(sortField, sortOrder).limit(limit).offset(offset);

    const [countResult, data] = await Promise.all([countQuery, dataQuery]);
    const total = countResult ? Number(countResult.count) : 0;

    return { data, total };
  }

  /**
   * Retrieve a customer by ID.
   */
  async findById(id: number): Promise<Customer | null> {
    const customer = await db('customers').where('id', id).whereNull('deleted_at').first();

    return customer || null;
  }

  /**
   * Get paginated transaction ledger for a customer.
   * Returns the page of transactions plus the total count for pagination controls.
   * Maximum limit is capped at 100 server-side regardless of what the caller requests.
   */
  async getTransactionLedger(
    customerId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: CustomerTransaction[]; total: number }> {
    const safeLimit = Math.min(limit, 100);
    const offset = (page - 1) * safeLimit;

    const baseQuery = db('customer_transactions')
      .leftJoin('employees', 'employees.id', 'customer_transactions.created_by')
      .select('customer_transactions.*', 'employees.full_name as created_by_name')
      .where('customer_id', customerId);

    const [countResult, data] = await Promise.all([
      baseQuery.clone().clearSelect().count({ count: 'customer_transactions.id' }).first(),
      baseQuery
        .clone()
        .orderBy('customer_transactions.created_at', 'desc')
        .limit(safeLimit)
        .offset(offset),
    ]);

    return {
      data,
      total: Number(countResult?.count ?? 0),
    };
  }

  /**
   * Register a new customer.
   */
  async create(
    input: CreateCustomerInput,
    _createdByUserId: number | null = null,
  ): Promise<Customer> {
    return db.transaction(async (trx) => {
      const [customer] = await trx('customers')
        .insert({
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          notes: input.notes || null,
          balance: 0.0,
          loyalty_points: input.loyalty_points || 0,
        })
        .returning('*');

      return customer;
    });
  }

  /**
   * Update an existing customer profile.
   */
  async update(id: number, input: UpdateCustomerInput): Promise<Customer> {
    const [customer] = await db('customers')
      .where('id', id)
      .update({
        ...input,
        updated_at: db.fn.now(),
      })
      .returning('*');

    if (!customer) {
      throw new Error(`Customer with ID ${id} not found or deleted.`);
    }

    return customer;
  }

  /**
   * Soft-delete a customer profile.
   */
  async softDelete(id: number): Promise<void> {
    const rowsAffected = await db('customers').where('id', id).update({
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

    if (rowsAffected === 0) {
      throw new Error(`Customer with ID ${id} not found or already deleted.`);
    }
  }

  /**
   * Records a customer balance payment with hard accounting controls.
   *
   * Guards (all inside one transaction, with a row lock on the customer):
   *   - amount must be positive and expressed in whole cents;
   *   - the customer must actually owe money (`balance < 0`);
   *   - the payment can never exceed the outstanding balance;
   *   - a duplicate `idempotency_key` returns the original result instead of
   *     posting a second ledger row;
   *   - the ledger row, cached balance and drawer cash move together or not at
   *     all (a mid-flight failure rolls all three back).
   *
   * Cash payments increase the shift's `expected_cash` immediately (the money is
   * physically in the drawer). Card payments are only recorded on the customer
   * ledger and are reported separately by `getShiftSummary`, because they settle
   * through the acquirer rather than the cash drawer.
   */
  async recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
    const amountCents = toCents(input.amount);

    if (amountCents <= 0) {
      throw new CustomerPaymentError('AMOUNT_INVALID', 'Payment amount must be greater than zero.');
    }

    try {
      return await db.transaction(async (trx) => {
        // 1. Lock the customer row so concurrent payments serialise.
        const customer = await trx('customers')
          .where({ id: input.customerId })
          .whereNull('deleted_at')
          .forUpdate()
          .first();

        if (!customer) {
          throw new Error(`Customer with ID ${input.customerId} not found or deleted.`);
        }

        // 0. Idempotency: a retried request must not post a second payment.
        if (input.idempotencyKey) {
          const existing = await trx('customer_transactions')
            .where({
              customer_id: input.customerId,
              idempotency_key: input.idempotencyKey,
            })
            .first();

          if (existing) {
            const current = await trx('customers').where({ id: input.customerId }).first();
            const currentBalanceCents = toCents(current?.balance ?? 0);
            return {
              customer: current as Customer,
              duplicate: true,
              appliedAmount: Number(existing.amount),
              outstandingBefore: 0,
              outstandingAfter: currentBalanceCents < 0 ? fromCents(-currentBalanceCents) : 0,
            };
          }
        }

        const balanceCents = toCents(customer.balance);
        const outstandingBeforeCents = balanceCents < 0 ? -balanceCents : 0;

        if (outstandingBeforeCents === 0) {
          throw new CustomerPaymentError(
            'NO_OUTSTANDING_BALANCE',
            'This customer has no outstanding balance to pay.',
          );
        }

        if (amountCents > outstandingBeforeCents) {
          throw new CustomerPaymentError(
            'PAYMENT_EXCEEDS_BALANCE',
            `Payment of ${fromCents(amountCents).toFixed(
              2,
            )} exceeds the outstanding balance of ${fromCents(outstandingBeforeCents).toFixed(2)}.`,
          );
        }

        // 2. The drawer being credited must be open.
        if (input.shiftId !== null) {
          const shift = await trx('cashier_shifts')
            .where({ id: input.shiftId, status: 'open' })
            .forUpdate().first();

          if (!shift) {
            throw new CustomerPaymentError(
              'SHIFT_NOT_OPEN',
              'The selected shift is not open. Reopen or select the correct shift before taking payment.',
            );
          }
        }

        const appliedAmount = fromCents(amountCents);

        // 3. Ledger + cached balance.
        await trx('customer_transactions').insert({
          customer_id: input.customerId,
          transaction_type: 'payment',
          amount: appliedAmount,
          reference_id: null,
          notes: input.notes || 'Customer account payment',
          created_by: input.userId,
          shift_id: input.shiftId,
          register_id: input.registerId,
          payment_method: input.paymentMethod,
          idempotency_key: input.idempotencyKey || null,
          created_at: trx.fn.now(),
        });

        const [updatedCustomer] = await trx('customers')
          .where('id', input.customerId)
          .update({
            balance: trx.raw('balance + ?', [appliedAmount]),
            updated_at: trx.fn.now(),
          })
          .returning('*');

        // 4. Cash is in the drawer right now; card settlements are not.
        if (input.paymentMethod === 'cash' && input.shiftId !== null) {
          await trx('cashier_shifts')
            .where('id', input.shiftId)
            .update({
              expected_cash: trx.raw('expected_cash + ?', [appliedAmount]),
              updated_at: trx.fn.now(),
            });
        }

        return {
          customer: updatedCustomer as Customer,
          duplicate: false,
          appliedAmount,
          outstandingBefore: fromCents(outstandingBeforeCents),
          outstandingAfter: fromCents(outstandingBeforeCents - amountCents),
        };
      });
    } catch (error: any) {
      // Lost the race against a concurrent identical request: the unique index
      // rejected the second ledger row, so return the original payment.
      if (error?.code === '23505' && input.idempotencyKey) {
        const existing = await db('customer_transactions')
          .where({ customer_id: input.customerId, idempotency_key: input.idempotencyKey })
          .first();
        if (existing) {
          const current = await db('customers').where({ id: input.customerId }).first();
          const currentBalanceCents = toCents(current?.balance ?? 0);
          return {
            customer: current as Customer,
            duplicate: true,
            appliedAmount: Number(existing.amount),
            outstandingBefore: 0,
            outstandingAfter: currentBalanceCents < 0 ? fromCents(-currentBalanceCents) : 0,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Atomically adjust a customer's balance and record a ledger transaction.
   * Positive amount increases balance (credit/payment), Negative reduces balance (debt).
   * Used by refunds and manual adjustments, which are not cash collections.
   */

  async recordTransaction(
    customerId: number,
    amount: number,
    type: 'payment' | 'adjustment' | 'sale',
    referenceId: string | null,
    notes: string | null,
    userId: number | null,
    shiftId?: number | null,
    registerId?: number | null,
    paymentMethod?: 'cash' | 'card' | null,
    externalTrx?: Knex.Transaction,
  ): Promise<Customer> {
    const exec = async (trx: Knex.Transaction) => {
      // 1. Double check customer exists with row-locking
      const customer = await trx('customers')
        .where('id', customerId)
        .whereNull('deleted_at')
        .forUpdate()
        .first();
      if (!customer) {
        throw new Error(`Customer with ID ${customerId} not found or deleted.`);
      }

      // 2. Insert into ledger
      await trx('customer_transactions').insert({
        customer_id: customerId,
        transaction_type: type,
        amount: amount,
        reference_id: referenceId,
        notes: notes,
        created_by: userId,
        shift_id: shiftId || null,
        register_id: registerId || null,
        payment_method: paymentMethod || 'cash',
        created_at: trx.fn.now(),
      });

      // 3. Update cached balance on customer row
      const [updatedCustomer] = await trx('customers')
        .where('id', customerId)
        .update({
          balance: trx.raw('balance + ?', [amount]),
          updated_at: trx.fn.now(),
        })
        .returning('*');

      return updatedCustomer;
    };

    if (externalTrx) {
      return exec(externalTrx);
    } else {
      return db.transaction(exec);
    }
  }
}

export const customerRepository = new CustomerRepository();
