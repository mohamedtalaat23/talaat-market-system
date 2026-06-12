import { db } from '../config/database';
import { bankersRound } from '../utils/currency';

export interface PurchaseOrderItem {
  id?: number;
  purchase_order_id?: number;
  product_id: number;
  ordered_quantity: number;
  received_quantity?: number;
  shortage_quantity?: number;
  shortage_reason?: string | null;
  unit_cost: number;
  line_total?: number;
  product_name?: string;
  barcode?: string | null;
}

export interface PurchaseOrder {
  id?: number;
  po_number?: string;
  supplier_id: number;
  status?: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  order_date?: Date;
  delivery_date?: Date | null;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  total?: number;
  created_by?: number | null;
  received_by?: number | null;
  notes?: string | null;
  created_at?: Date;
  updated_at?: Date;
  supplier_name?: string;
  supplier_code?: string;
  items?: PurchaseOrderItem[];
}

export interface CreatePOInput {
  supplier_id: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
  items: Array<{
    product_id: number;
    ordered_quantity: number;
    unit_cost: number;
  }>;
}

export interface UpdatePOInput {
  supplier_id: number;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string | null;
  items: Array<{
    product_id: number;
    ordered_quantity: number;
    unit_cost: number;
  }>;
}

export interface ReceiveItemInput {
  po_item_id: number;
  product_id: number;
  quantity_to_receive: number;
  shortage_quantity?: number;
  shortage_reason?: string | null;
}

export class PurchaseRepository {
  /**
   * Find purchase orders with pagination and filtering
   */
  async getList(filters: { status?: string; supplier_id?: number; page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    const page = filters.page || 1;
    const limit = filters.limit || 15;
    const offset = (page - 1) * limit;

    const query = db('purchase_orders as po')
      .join('suppliers as s', 's.id', 'po.supplier_id')
      .leftJoin('employees as e', 'e.id', 'po.created_by')
      .select(
        'po.*',
        's.name as supplier_name',
        's.supplier_code as supplier_code',
        'e.full_name as creator_name',
      );

    if (filters.status) {
      query.where('po.status', filters.status);
    }

    if (filters.supplier_id) {
      query.where('po.supplier_id', filters.supplier_id);
    }

    const [countResult] = await query.clone().clearSelect().count({ total: 'po.id' });
    const total = Number(countResult?.total || 0);

    let sortField = 'po.created_at';
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'date':
          sortField = 'po.order_date';
          break;
        case 'supplier':
          sortField = 's.name';
          break;
        case 'total':
          sortField = 'po.total';
          break;
        case 'status':
          sortField = 'po.status';
          break;
      }
    }

    const pos = await query.orderBy(sortField, filters.sortOrder || 'desc').limit(limit).offset(offset);

    const items = pos.map((po) => ({
      ...po,
      subtotal: Number(po.subtotal),
      discount_amount: Number(po.discount_amount),
      tax_amount: Number(po.tax_amount),
      total: Number(po.total),
    }));

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Fetch purchase order details and join lines
   */
  async getDetail(id: number): Promise<PurchaseOrder | null> {
    const po = await db('purchase_orders as po')
      .join('suppliers as s', 's.id', 'po.supplier_id')
      .leftJoin('employees as ec', 'ec.id', 'po.created_by')
      .leftJoin('employees as er', 'er.id', 'po.received_by')
      .where('po.id', id)
      .select(
        'po.*',
        's.name as supplier_name',
        's.supplier_code as supplier_code',
        'ec.full_name as creator_name',
        'er.full_name as receiver_name',
      )
      .first();

    if (!po) return null;

    const items = await db('purchase_order_items as poi')
      .join('products as p', 'p.id', 'poi.product_id')
      .where('poi.purchase_order_id', id)
      .select(
        'poi.*',
        'p.name as product_name',
        'p.name_ar as product_name_ar',
        'p.barcode as barcode',
        'p.unit as unit',
      );

    return {
      ...po,
      subtotal: Number(po.subtotal),
      discount_amount: Number(po.discount_amount),
      tax_amount: Number(po.tax_amount),
      total: Number(po.total),
      items: items.map((i) => ({
        ...i,
        ordered_quantity: Number(i.ordered_quantity),
        received_quantity: Number(i.received_quantity),
        shortage_quantity: Number(i.shortage_quantity || 0),
        unit_cost: Number(i.unit_cost),
        line_total: Number(i.line_total),
      })),
    };
  }

  /**
   * Create new draft purchase order
   */
  async create(input: CreatePOInput, creatorId: number): Promise<PurchaseOrder> {
    return await db.transaction(async (trx) => {
      // 1. Calculate subtotal & grand total with decimal rounding
      let subtotal = 0;
      const discount = input.discount_amount || 0;
      const tax = input.tax_amount || 0;

      for (const item of input.items) {
        subtotal += item.ordered_quantity * item.unit_cost;
      }
      subtotal = bankersRound(subtotal);
      const total = bankersRound(subtotal - discount + tax);

      // 2. Generate custom PO Number
      const { rows } = await trx.raw(`SELECT nextval('purchase_order_number_seq') as seq`);
      const seq = String(rows[0].seq).padStart(5, '0');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const poNumber = `PO-${dateStr}-${seq}`;

      // 3. Insert Purchase Order Header
      const [po] = await trx('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: input.supplier_id,
          status: 'draft',
          subtotal,
          discount_amount: discount,
          tax_amount: tax,
          total,
          created_by: creatorId,
          notes: input.notes || null,
        })
        .returning('*');

      // 4. Insert Purchase Order Line Items
      const itemsToInsert = input.items.map((item) => ({
        purchase_order_id: po.id,
        product_id: item.product_id,
        ordered_quantity: item.ordered_quantity,
        received_quantity: 0,
        unit_cost: item.unit_cost,
        line_total: item.ordered_quantity * item.unit_cost,
      }));

      const insertedItems = await trx('purchase_order_items').insert(itemsToInsert).returning('*');

      return {
        ...po,
        items: insertedItems,
      };
    });
  }

  /**
   * Update draft purchase order details
   */
  async update(id: number, input: UpdatePOInput): Promise<PurchaseOrder> {
    return await db.transaction(async (trx) => {
      const po = await trx('purchase_orders').where({ id, status: 'draft' }).first();
      if (!po) throw new Error('Purchase order not found or is no longer a draft');

      // 1. Recalculate totals with decimal rounding
      let subtotal = 0;
      const discount = input.discount_amount || 0;
      const tax = input.tax_amount || 0;

      for (const item of input.items) {
        subtotal += item.ordered_quantity * item.unit_cost;
      }
      subtotal = bankersRound(subtotal);
      const total = bankersRound(subtotal - discount + tax);

      // 2. Update Header
      const [updatedPo] = await trx('purchase_orders')
        .where('id', id)
        .update({
          supplier_id: input.supplier_id,
          subtotal,
          discount_amount: discount,
          tax_amount: tax,
          total,
          notes: input.notes || null,
          updated_at: trx.fn.now(),
        })
        .returning('*');

      // 3. Wipe and replace existing line items
      await trx('purchase_order_items').where('purchase_order_id', id).del();

      const itemsToInsert = input.items.map((item) => ({
        purchase_order_id: id,
        product_id: item.product_id,
        ordered_quantity: item.ordered_quantity,
        received_quantity: 0,
        unit_cost: item.unit_cost,
        line_total: item.ordered_quantity * item.unit_cost,
      }));

      const insertedItems = await trx('purchase_order_items').insert(itemsToInsert).returning('*');

      return {
        ...updatedPo,
        items: insertedItems,
      };
    });
  }

  /**
   * Update status (e.g. from draft to ordered, or cancel draft/ordered PO)
   */
  async updateStatus(id: number, status: 'ordered' | 'cancelled'): Promise<void> {
    const po = await db('purchase_orders').where('id', id).first();
    if (!po) throw new Error('Purchase order not found');

    if (po.status === 'received') {
      throw new Error('Completed purchase orders cannot be cancelled or altered');
    }

    if (status === 'ordered' && po.status !== 'draft') {
      throw new Error('Only draft purchase orders can be ordered');
    }

    await db('purchase_orders').where('id', id).update({
      status,
      updated_at: db.fn.now(),
    });
  }

  /**
   * Complete purchase order and increment warehouse inventories (AVCO updates)
   */
  async receiveGoods(
    id: number,
    receivedItems: ReceiveItemInput[],
    receiverId: number,
    notes?: string
  ): Promise<void> {
    return await db.transaction(async (trx) => {
      // 1. Lock and verify the purchase order
      const po = await trx('purchase_orders').where({ id }).forUpdate().first();
      if (!po) throw new Error('Purchase order not found');
      if (po.status !== 'ordered' && po.status !== 'partially_received') {
        throw new Error('Only ordered or partially received purchase orders can be received');
      }

      // 2. Fetch original order lines
      const lines = await trx('purchase_order_items').where('purchase_order_id', id);
      const lineMap = new Map(lines.map((l) => [l.id, l]));

      // Hostile Check: Validate totals
      for (const item of receivedItems) {
        const line = lineMap.get(item.po_item_id);
        if (!line) throw new Error(`PO Item ${item.po_item_id} is not part of this purchase order`);

        const qtyToReceive = Number(item.quantity_to_receive || 0);
        const shortageQty = Number(item.shortage_quantity || 0);

        const alreadyReceived = Number(line.received_quantity || 0);
        const alreadyShortage = Number(line.shortage_quantity || 0);
        const orderedQty = Number(line.ordered_quantity || 0);

        const newTotalResolution = alreadyReceived + qtyToReceive + alreadyShortage + shortageQty;

        if (newTotalResolution > orderedQty) {
          throw new Error(`Total resolution (${newTotalResolution}) cannot exceed ordered quantity (${orderedQty}) for product ${item.product_id}`);
        }
      }

      // Generate Receipt Header
      const { rows } = await trx.raw(`SELECT nextval('purchase_order_number_seq') as seq`);
      const seq = String(rows[0].seq).padStart(5, '0');
      const receiptNumber = `REC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${seq}`;

      const [receipt] = await trx('purchase_order_receipts').insert({
        purchase_order_id: id,
        receipt_number: receiptNumber,
        status: 'posted',
        received_by: receiverId,
        notes: notes || null,
      }).returning('*');

      const sortedReceivedItems = [...receivedItems].sort((a, b) => a.product_id - b.product_id);

      for (const item of sortedReceivedItems) {
        const line = lineMap.get(item.po_item_id)!;
        const qtyToReceive = Number(item.quantity_to_receive || 0);
        const shortageQty = Number(item.shortage_quantity || 0);

        if (qtyToReceive > 0) {
          // A. Update line quantities
          await trx('purchase_order_items')
            .where({ id: item.po_item_id })
            .increment('received_quantity', qtyToReceive);

          if (shortageQty > 0) {
             await trx('purchase_order_items')
              .where({ id: item.po_item_id })
              .increment('shortage_quantity', shortageQty)
              .update({ shortage_reason: item.shortage_reason || null });
          }

          // B. Insert receipt item
          await trx('purchase_order_receipt_items').insert({
            receipt_id: receipt.id,
            po_item_id: item.po_item_id,
            product_id: item.product_id,
            quantity_received: qtyToReceive,
            unit_cost: line.unit_cost
          });

          // C. Query current physical warehouse stock and catalog costs
          const inv = await trx('inventory').where('product_id', item.product_id).forUpdate().first();
          const product = await trx('products')
            .where('id', item.product_id)
            .select('cost_price')
            .first();

          const currentStock = inv ? Number(inv.quantity) : 0;
          const currentCost = product ? Number(product.cost_price) : 0;
          const addStock = qtyToReceive;
          const itemCost = Number(line.unit_cost);

          // D. AVCO recalculation
          let finalCostPrice = itemCost;
          if (currentStock > 0 && currentStock + addStock > 0) {
            finalCostPrice =
              (currentStock * currentCost + addStock * itemCost) / (currentStock + addStock);
          }
          finalCostPrice = bankersRound(finalCostPrice);

          // E. Increment inventory
          try {
            if (!inv) {
              await trx('inventory').insert({
                product_id: item.product_id,
                quantity: addStock,
                reserved_quantity: 0,
                updated_at: trx.fn.now(),
              });
            } else {
              await trx('inventory')
                .where('product_id', item.product_id)
                .increment('quantity', addStock)
                .update({ updated_at: trx.fn.now() });
            }
          } catch (err: any) {
            if (err.code === '23505') {
              await trx('inventory')
                .where('product_id', item.product_id)
                .increment('quantity', addStock)
                .update({ updated_at: trx.fn.now() });
            } else {
              throw err;
            }
          }

          // F. Log adjustment
          await trx('inventory_adjustments').insert({
            product_id: item.product_id,
            adjustment_type: 'purchase_receipt',
            quantity_change: addStock,
            old_quantity: currentStock,
            new_quantity: currentStock + addStock,
            notes: `Purchase Order goods receipt: ${receiptNumber} (PO: ${po.po_number})`,
            created_by: receiverId,
          });

          // G. Persist cost price
          await trx('products')
            .where('id', item.product_id)
            .update({ cost_price: finalCostPrice, updated_at: trx.fn.now() });
        } else if (shortageQty > 0) {
          // Just update shortage
          await trx('purchase_order_items')
            .where({ id: item.po_item_id })
            .increment('shortage_quantity', shortageQty)
            .update({ shortage_reason: item.shortage_reason || null });
        }
      }

      // Check PO final state
      const updatedLines = await trx('purchase_order_items').where('purchase_order_id', id);
      let allResolved = true;
      for (const l of updatedLines) {
        const resolved = Number(l.received_quantity) + Number(l.shortage_quantity);
        if (resolved < Number(l.ordered_quantity)) {
          allResolved = false;
          break;
        }
      }

      const newStatus = allResolved ? 'received' : 'partially_received';

      await trx('purchase_orders').where('id', id).update({
        status: newStatus,
        delivery_date: newStatus === 'received' ? trx.fn.now() : po.delivery_date,
        received_by: newStatus === 'received' ? receiverId : po.received_by,
        updated_at: trx.fn.now(),
      });
    });
  }
  /**
   * Fetch receiving history for a PO
   */
  async getReceipts(poId: number) {
    const receipts = await db('purchase_order_receipts as por')
      .join('employees as e', 'e.id', 'por.received_by')
      .where('por.purchase_order_id', poId)
      .select('por.*', 'e.full_name as receiver_name')
      .orderBy('por.created_at', 'desc');

    const receiptIds = receipts.map((r) => r.id);
    if (receiptIds.length === 0) return [];

    const items = await db('purchase_order_receipt_items as pori')
      .join('products as p', 'p.id', 'pori.product_id')
      .whereIn('pori.receipt_id', receiptIds)
      .select(
        'pori.*',
        'p.name as product_name',
        'p.barcode as barcode',
        'p.unit as unit'
      );

    return receipts.map((receipt) => ({
      ...receipt,
      items: items.filter((i) => i.receipt_id === receipt.id).map(i => ({
        ...i,
        quantity_received: Number(i.quantity_received),
        unit_cost: Number(i.unit_cost)
      })),
    }));
  }
}

export const purchaseRepository = new PurchaseRepository();
