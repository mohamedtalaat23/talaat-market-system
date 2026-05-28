import { db } from '../config/database';
import type { Knex } from 'knex';

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
   * List all customers (excluding soft-deleted ones by default) with optional text search.
   */
  async findAll(search?: string, limit = 50, offset = 0): Promise<Customer[]> {
    let query = db('customers').whereNull('deleted_at');

    if (search) {
      const cleanSearch = search.trim();
      query = query.andWhere((builder) => {
        builder.where('name', 'ilike', `%${cleanSearch}%`)
          .orWhere('phone', 'like', `%${cleanSearch}%`);
      });
    }

    return query
      .orderBy('name', 'asc')
      .limit(limit)
      .offset(offset);
  }

  /**
   * Retrieve a customer by ID.
   */
  async findById(id: number): Promise<Customer | null> {
    const customer = await db('customers')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    return customer || null;
  }

  /**
   * Get full transaction ledger for a customer.
   */
  async getTransactionLedger(customerId: number): Promise<CustomerTransaction[]> {
    return db('customer_transactions')
      .leftJoin('employees', 'employees.id', 'customer_transactions.created_by')
      .select(
        'customer_transactions.*',
        'employees.full_name as created_by_name'
      )
      .where('customer_id', customerId)
      .orderBy('customer_transactions.created_at', 'desc');
  }

  /**
   * Register a new customer.
   */
  async create(input: CreateCustomerInput, createdByUserId: number | null = null): Promise<Customer> {
    return db.transaction(async (trx) => {
      const [customer] = await trx('customers')
        .insert({
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          notes: input.notes || null,
          balance: input.balance || 0.00,
          loyalty_points: input.loyalty_points || 0,
        })
        .returning('*');

      // If there is an initial balance, log it as an initial adjustment transaction
      if (input.balance && input.balance !== 0) {
        await trx('customer_transactions').insert({
          customer_id: customer.id,
          transaction_type: 'adjustment',
          amount: input.balance,
          notes: 'Initial account balance setup',
          created_by: createdByUserId,
        });
      }

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
        updated_at: db.fn.now()
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
    const rowsAffected = await db('customers')
      .where('id', id)
      .update({
        deleted_at: db.fn.now(),
        updated_at: db.fn.now()
      });

    if (rowsAffected === 0) {
      throw new Error(`Customer with ID ${id} not found or already deleted.`);
    }
  }

  /**
   * Atomically adjust a customer's balance and record a ledger transaction.
   * Positive amount increases balance (credit/payment), Negative reduces balance (debt).
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
    externalTrx?: Knex.Transaction
  ): Promise<Customer> {
    const exec = async (trx: Knex.Transaction) => {
      // 1. Double check customer exists
      const customer = await trx('customers').where('id', customerId).whereNull('deleted_at').first();
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
        created_at: trx.fn.now()
      });

      // 3. Update cached balance on customer row
      const [updatedCustomer] = await trx('customers')
        .where('id', customerId)
        .increment('balance', amount)
        .update({ updated_at: trx.fn.now() })
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
