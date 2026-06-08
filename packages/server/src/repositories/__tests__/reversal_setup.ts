import { db } from '../../config/database';

export async function setupTestData() {
  const [manager] = await db('employees').insert({
    full_name: 'Test Manager',
    username: 'mgr_test_' + Date.now(),
    password_hash: 'hashed',
    role: 'manager',
    is_active: true
  }).returning('id');

  const [cashier] = await db('employees').insert({
    full_name: 'Test Cashier',
    username: 'csh_test_' + Date.now(),
    password_hash: 'hashed',
    role: 'cashier',
    is_active: true
  }).returning('id');

  const [register] = await db('registers').insert({
    name: 'Test Register',
    status: 'active'
  }).returning('id');

  const [shift] = await db('cashier_shifts').insert({
    employee_id: cashier.id,
    register_id: register.id,
    starting_cash: 1000,
    status: 'open'
  }).returning('id');

  const [product] = await db('products').insert({
    name: 'Test Product',
    barcode: 'BAR-' + Date.now(),
    selling_price: 10,
    cost_price: 5,
    category_id: null
  }).returning('id');

  await db('inventory').insert({
    product_id: product.id,
    quantity: 100
  });

  const [customer] = await db('customers').insert({
    name: 'Test Customer',
    balance: -50 // Owe 50
  }).returning('id');

  return { managerId: manager.id, cashierId: cashier.id, registerId: register.id, shiftId: shift.id, productId: product.id, customerId: customer.id };
}
