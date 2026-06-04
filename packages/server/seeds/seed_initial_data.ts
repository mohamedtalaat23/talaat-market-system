import { type Knex } from 'knex';
import bcrypt from 'bcryptjs';

/**
 * Supermarket Sample Data Seed
 * 
 * Seeds the database with realistic products, categories, employees,
 * inventory stock levels, and historical transactions.
 * Safely clears existing records in dependency order so it can be rerun.
 */
export async function seed(knex: Knex): Promise<void> {
  // 1. Clean existing tables in reverse dependency order using TRUNCATE CASCADE
  await knex.raw(`
    TRUNCATE TABLE 
      purchase_order_items, 
      purchase_orders, 
      suppliers, 
      customer_transactions, 
      customers, 
      inventory_adjustments, 
      manager_overrides,
      cashier_shifts, 
      sale_items, 
      sales, 
      inventory, 
      products, 
      categories, 
      employees 
    RESTART IDENTITY CASCADE;
  `).catch((err) => {
    console.warn('Truncate warning, falling back to manual delete:', err.message);
  });

  // 2. Seed Employees
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const managerPassword = bcrypt.hashSync('manager123', 10);
  const cashierPassword = bcrypt.hashSync('cashier123', 10);

  const adminPin = bcrypt.hashSync('1111', 10);
  const managerPin = bcrypt.hashSync('2222', 10);
  const cashier1Pin = bcrypt.hashSync('3333', 10);
  const cashier2Pin = bcrypt.hashSync('4444', 10);

  const [admin, manager, cashier1, cashier2] = await knex('employees').insert([
    {
      full_name: 'System Administrator',
      username: 'admin',
      password_hash: adminPassword,
      pin_hash: adminPin,
      role: 'admin',
      is_active: true,
    },
    {
      full_name: 'Supermarket Manager',
      username: 'manager',
      password_hash: managerPassword,
      pin_hash: managerPin,
      role: 'manager',
      is_active: true,
    },
    {
      full_name: 'Sarah Connor',
      username: 'cashier1',
      password_hash: cashierPassword,
      pin_hash: cashier1Pin,
      role: 'cashier',
      is_active: true,
    },
    {
      full_name: 'John Doe',
      username: 'cashier2',
      password_hash: cashierPassword,
      pin_hash: cashier2Pin,
      role: 'cashier',
      is_active: true,
    },
  ]).returning('*');

  // 3. Seed Categories
  const [beverages, dairy, bakery, produce, snacks, household] = await knex('categories').insert([
    { name: 'Beverages', name_ar: 'مشروبات', is_active: true },
    { name: 'Dairy & Eggs', name_ar: 'ألبان وبيض', is_active: true },
    { name: 'Bakery', name_ar: 'مخبوزات', is_active: true },
    { name: 'Fruits & Vegetables', name_ar: 'فواكه وخضروات', is_active: true },
    { name: 'Snacks & Sweets', name_ar: 'تسالي وحلويات', is_active: true },
    { name: 'Household & Cleaning', name_ar: 'منظفات ومنزلية', is_active: true },
  ]).returning('*');

  // 4. Seed Products
  const productsToSeed = [
    // Beverages
    {
      barcode: '5449000000996',
      name: 'Coca-Cola Can 330ml',
      name_ar: 'كوكاكولا كانز ٣٣٠ مل',
      category_id: beverages.id,
      unit: 'pcs',
      cost_price: 0.30,
      selling_price: 0.60,
      min_stock_level: 24.000,
      max_stock_level: 200.000,
    },
    {
      barcode: '6221007011244',
      name: 'Mineral Water 1.5L',
      name_ar: 'مياه معدنية ١.٥ لتر',
      category_id: beverages.id,
      unit: 'pcs',
      cost_price: 0.15,
      selling_price: 0.35,
      min_stock_level: 48.000,
      max_stock_level: 300.000,
    },
    {
      barcode: '6221008022034',
      name: 'Mango Juice 1L',
      name_ar: 'عصير مانجو ١ لتر',
      category_id: beverages.id,
      unit: 'pcs',
      cost_price: 0.75,
      selling_price: 1.20,
      min_stock_level: 12.000,
      max_stock_level: 80.000,
    },
    // Dairy & Eggs
    {
      barcode: '6221034015024',
      name: 'Fresh Milk 1L',
      name_ar: 'حليب طازج ١ لتر',
      category_id: dairy.id,
      unit: 'pcs',
      cost_price: 1.10,
      selling_price: 1.50,
      min_stock_level: 10.000,
      max_stock_level: 50.000,
    },
    {
      barcode: '6221045022011',
      name: 'Greek Yogurt 150g',
      name_ar: 'زبادي يوناني ١٥٠ جم',
      category_id: dairy.id,
      unit: 'pcs',
      cost_price: 0.45,
      selling_price: 0.70,
      min_stock_level: 10.000,
      max_stock_level: 60.000,
    },
    {
      barcode: '6221034016014',
      name: 'White Cheese 500g',
      name_ar: 'جبنة بيضاء ٥٠٠ جم',
      category_id: dairy.id,
      unit: 'pcs',
      cost_price: 1.80,
      selling_price: 2.40,
      min_stock_level: 5.000,
      max_stock_level: 30.000,
    },
    {
      barcode: '6222003011011',
      name: 'Large Eggs 30 Pack',
      name_ar: 'طبق بيض كبير ٣٠ بيضة',
      category_id: dairy.id,
      unit: 'pcs',
      cost_price: 3.50,
      selling_price: 4.50,
      min_stock_level: 5.000,
      max_stock_level: 40.000,
    },
    // Bakery
    {
      barcode: '6221001011035',
      name: 'Sliced Toast Bread',
      name_ar: 'توست شرائح',
      category_id: bakery.id,
      unit: 'pcs',
      cost_price: 0.80,
      selling_price: 1.20,
      min_stock_level: 10.000,
      max_stock_level: 40.000,
    },
    {
      barcode: '6221001011042',
      name: 'French Baguette',
      name_ar: 'خبز باجيت فرنسي',
      category_id: bakery.id,
      unit: 'pcs',
      cost_price: 0.20,
      selling_price: 0.45,
      min_stock_level: 15.000,
      max_stock_level: 50.000,
    },
    // Fruits & Vegetables (Weighted items)
    {
      barcode: 'PLU0101',
      name: 'Local Apples',
      name_ar: 'تفاح محلي',
      category_id: produce.id,
      unit: 'kg',
      cost_price: 1.20,
      selling_price: 2.00,
      min_stock_level: 20.000,
      max_stock_level: 100.000,
    },
    {
      barcode: 'PLU0102',
      name: 'Bananas',
      name_ar: 'موز',
      category_id: produce.id,
      unit: 'kg',
      cost_price: 0.90,
      selling_price: 1.50,
      min_stock_level: 20.000,
      max_stock_level: 100.000,
    },
    {
      barcode: 'PLU0103',
      name: 'Tomatoes',
      name_ar: 'طماطم',
      category_id: produce.id,
      unit: 'kg',
      cost_price: 0.40,
      selling_price: 0.80,
      min_stock_level: 30.000,
      max_stock_level: 150.000,
    },
    {
      barcode: 'PLU0104',
      name: 'Potatoes',
      name_ar: 'بطاطس',
      category_id: produce.id,
      unit: 'kg',
      cost_price: 0.30,
      selling_price: 0.60,
      min_stock_level: 40.000,
      max_stock_level: 200.000,
    },
    // Snacks
    {
      barcode: '6221011011099',
      name: 'Potato Chips Salt 50g',
      name_ar: 'شيبسي ملح ٥٠ جم',
      category_id: snacks.id,
      unit: 'pcs',
      cost_price: 0.35,
      selling_price: 0.60,
      min_stock_level: 30.000,
      max_stock_level: 150.000,
    },
    {
      barcode: '7622300744961',
      name: 'Chocolate Bar 40g',
      name_ar: 'قالب شوكولاتة ٤٠ جم',
      category_id: snacks.id,
      unit: 'pcs',
      cost_price: 0.50,
      selling_price: 0.90,
      min_stock_level: 20.000,
      max_stock_level: 100.000,
    },
    // Household
    {
      barcode: '6221155022019',
      name: 'Dish Soap 1L',
      name_ar: 'سائل غسيل أطباق ١ لتر',
      category_id: household.id,
      unit: 'pcs',
      cost_price: 1.20,
      selling_price: 1.80,
      min_stock_level: 10.000,
      max_stock_level: 50.000,
    },
    {
      barcode: '6221166033012',
      name: 'Trash Bags 30L',
      name_ar: 'أكياس قمامة ٣٠ لتر',
      category_id: household.id,
      unit: 'pcs',
      cost_price: 1.50,
      selling_price: 2.20,
      min_stock_level: 8.000,
      max_stock_level: 40.000,
    },
  ];

  const insertedProducts = await knex('products').insert(productsToSeed).returning('*');

  // Helper map to find product by barcode/PLU in a single-pass reduce
  const productMap = insertedProducts.reduce<Record<string, typeof insertedProducts[0]>>((acc, prod) => {
    if (prod.barcode) {
      acc[prod.barcode] = prod;
    }
    return acc;
  }, {});

  // 5. Seed Inventory matching product list
  const inventories = insertedProducts.map((prod) => {
    let qty = 50.000;
    if (prod.barcode === '5449000000996') qty = 120.000; // Coke
    else if (prod.barcode === '6221007011244') qty = 200.000; // Water
    else if (prod.barcode === '6221008022034') qty = 45.000; // Juice
    else if (prod.barcode === '6221034015024') qty = 30.000; // Milk
    else if (prod.barcode === '6221001011035') qty = 8.000; // Toast (Low stock!)
    else if (prod.barcode === '6221001011042') qty = 3.000; // Baguette (Low stock!)
    else if (prod.barcode === 'PLU0101') qty = 45.500; // Apples
    else if (prod.barcode === 'PLU0102') qty = 60.250; // Bananas
    else if (prod.barcode === 'PLU0103') qty = 35.800; // Tomatoes
    else if (prod.barcode === 'PLU0104') qty = 80.000; // Potatoes

    return {
      product_id: prod.id,
      quantity: qty,
      reserved_quantity: 0.000,
      last_counted_at: new Date(),
    };
  });

  await knex('inventory').insert(inventories);

  // 6. Seed Historical Sales (over the last 3 days)
  const dateOffset = (days: number, hours: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(d.getHours() - hours);
    return d;
  };

  // Sale 1: Cashier 1, Cash, 2 days ago
  const coke = productMap['5449000000996'];
  const apples = productMap['PLU0101'];
  const sale1Subtotal = (2 * Number(coke.selling_price)) + (1.5 * Number(apples.selling_price)); // 1.20 + 3.00 = 4.20
  const sale1Discount = 0.00;
  const sale1Total = sale1Subtotal - sale1Discount;

  const [sale1] = await knex('sales').insert({
    receipt_number: 'TM-20260521-0001',
    cashier_id: cashier1.id,
    payment_method: 'cash',
    subtotal: sale1Subtotal,
    discount_amount: sale1Discount,
    tax_amount: 0.00,
    total: sale1Total,
    cash_received: 5.00,
    change_given: 0.80,
    status: 'completed',
    notes: 'Standard cashier checkout',
    created_at: dateOffset(2, 4),
  }).returning('*');

  await knex('sale_items').insert([
    {
      sale_id: sale1.id,
      product_id: coke.id,
      quantity: 2.000,
      unit_price: coke.selling_price,
      discount: 0.00,
      line_total: 2 * Number(coke.selling_price),
      cost_at_sale: coke.cost_price,
      created_at: dateOffset(2, 4),
    },
    {
      sale_id: sale1.id,
      product_id: apples.id,
      quantity: 1.500,
      unit_price: apples.selling_price,
      discount: 0.00,
      line_total: 1.5 * Number(apples.selling_price),
      cost_at_sale: apples.cost_price,
      created_at: dateOffset(2, 4),
    },
  ]);

  // Sale 2: Cashier 2, Card, 1 day ago
  const eggs = productMap['6222003011011'];
  const toast = productMap['6221001011035'];
  const milk = productMap['6221034015024'];
  const sale2Subtotal = Number(eggs.selling_price) + Number(toast.selling_price) + Number(milk.selling_price); // 4.50 + 1.20 + 1.50 = 7.20
  const sale2Discount = 0.20;
  const sale2Total = sale2Subtotal - sale2Discount; // 7.00

  const [sale2] = await knex('sales').insert({
    receipt_number: 'TM-20260522-0001',
    cashier_id: cashier2.id,
    payment_method: 'card',
    subtotal: sale2Subtotal,
    discount_amount: sale2Discount,
    tax_amount: 0.00,
    total: sale2Total,
    cash_received: sale2Total,
    change_given: 0.00,
    status: 'completed',
    created_at: dateOffset(1, 2),
  }).returning('*');

  await knex('sale_items').insert([
    {
      sale_id: sale2.id,
      product_id: eggs.id,
      quantity: 1.000,
      unit_price: eggs.selling_price,
      discount: 0.00,
      line_total: eggs.selling_price,
      cost_at_sale: eggs.cost_price,
      created_at: dateOffset(1, 2),
    },
    {
      sale_id: sale2.id,
      product_id: toast.id,
      quantity: 1.000,
      unit_price: toast.selling_price,
      discount: 0.20,
      line_total: Number(toast.selling_price) - 0.20,
      cost_at_sale: toast.cost_price,
      created_at: dateOffset(1, 2),
    },
    {
      sale_id: sale2.id,
      product_id: milk.id,
      quantity: 1.000,
      unit_price: milk.selling_price,
      discount: 0.00,
      line_total: milk.selling_price,
      cost_at_sale: milk.cost_price,
      created_at: dateOffset(1, 2),
    },
  ]);

  // Sale 3: Cashier 1, Cash, today (earlier)
  const soap = productMap['6221155022019'];
  const water = productMap['6221007011244'];
  const sale3Subtotal = Number(soap.selling_price) + (3 * Number(water.selling_price)); // 1.80 + 1.05 = 2.85
  const sale3Discount = 0.00;
  const sale3Total = sale3Subtotal;

  const [sale3] = await knex('sales').insert({
    receipt_number: 'TM-20260523-0001',
    cashier_id: cashier1.id,
    payment_method: 'cash',
    subtotal: sale3Subtotal,
    discount_amount: sale3Discount,
    tax_amount: 0.00,
    total: sale3Total,
    cash_received: 5.00,
    change_given: 2.15,
    status: 'completed',
    created_at: dateOffset(0, 5),
  }).returning('*');

  await knex('sale_items').insert([
    {
      sale_id: sale3.id,
      product_id: soap.id,
      quantity: 1.000,
      unit_price: soap.selling_price,
      discount: 0.00,
      line_total: soap.selling_price,
      cost_at_sale: soap.cost_price,
      created_at: dateOffset(0, 5),
    },
    {
      sale_id: sale3.id,
      product_id: water.id,
      quantity: 3.000,
      unit_price: water.selling_price,
      discount: 0.00,
      line_total: 3 * Number(water.selling_price),
      cost_at_sale: water.cost_price,
      created_at: dateOffset(0, 5),
    },
  ]);
}
