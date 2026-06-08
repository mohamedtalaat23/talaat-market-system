import { db } from './src/config/database';
import { purchaseRepository } from './src/repositories/purchase.repository';
import { productRepository } from './src/repositories/product.repository';

async function run() {
  try {
    const product = await productRepository.create({
      name: 'Test Ledger Product 12',
      barcode: 'LEDGER-012',
      category_id: 1,
      cost_price: 10,
      selling_price: 15,
      min_stock_level: 5,
      max_stock_level: 50,
      is_active: true
    });
    await productRepository.createInventory(product.id, 50);

    const [po] = await db('purchase_orders').insert({
      supplier_id: 1,
      po_number: 'PO-LEDGER-12-' + Date.now(),
      status: 'ordered',
      total: 1500,
      created_by: 2
    }).returning('*');
    
    await db('purchase_order_items').insert({
      purchase_order_id: po.id,
      product_id: product.id,
      ordered_quantity: 100,
      unit_cost: 15,
      line_total: 1500
    });

    await purchaseRepository.receiveGoods(po.id, [
      { product_id: product.id, received_quantity: 100 }
    ], 2);
    
    let adj = await db('inventory_adjustments').where('product_id', product.id).orderBy('id', 'desc').first();
    console.log(`PO Receipt adjustment type: ${adj?.adjustment_type}, qty: ${adj?.quantity_change}`);

    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}
run();
