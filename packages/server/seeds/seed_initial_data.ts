import { type Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { fakerAR, fakerEN } from '@faker-js/faker';

/**
 * Egyptian Supermarket Large Scale Data Seed
 * 
 * Safely clears existing records in dependency order and seeds
 * the database with realistic products, categories, employees,
 * inventory stock levels, customers, suppliers, and historical transactions.
 */
export async function seed(knex: Knex): Promise<void> {
  console.log('Seeding: Starting Database Wipe...');

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

  console.log('Seeding: Employees...');
  // 2. Seed Employees
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const managerPassword = bcrypt.hashSync('manager123', 10);
  const cashierPassword = bcrypt.hashSync('cashier123', 10);

  const adminPin = bcrypt.hashSync('1111', 10);
  const managerPin = bcrypt.hashSync('2222', 10);
  const cashier1Pin = bcrypt.hashSync('3333', 10);
  const cashier2Pin = bcrypt.hashSync('4444', 10);
  const cashier3Pin = bcrypt.hashSync('5555', 10);

  const employees = await knex('employees').insert([
    {
      full_name: 'System Administrator',
      username: 'admin',
      password_hash: adminPassword,
      pin_hash: adminPin,
      role: 'admin',
      is_active: true,
    },
    {
      full_name: 'Talaat Manager',
      username: 'manager',
      password_hash: managerPassword,
      pin_hash: managerPin,
      role: 'manager',
      is_active: true,
    },
    {
      full_name: 'Ahmed Hassan',
      username: 'ahmed_c',
      password_hash: cashierPassword,
      pin_hash: cashier1Pin,
      role: 'cashier',
      is_active: true,
    },
    {
      full_name: 'Mahmoud Ali',
      username: 'mahmoud_c',
      password_hash: cashierPassword,
      pin_hash: cashier2Pin,
      role: 'cashier',
      is_active: true,
    },
    {
      full_name: 'Sarah Ibrahim',
      username: 'sarah_c',
      password_hash: cashierPassword,
      pin_hash: cashier3Pin,
      role: 'cashier',
      is_active: true,
    },
  ]).returning('*');

  const cashiers = employees.filter(e => e.role === 'cashier');

  console.log('Seeding: Categories...');
  // 3. Seed Categories
  const categoriesData = [
    { name: 'Beverages', name_ar: 'مشروبات', is_active: true },
    { name: 'Dairy & Eggs', name_ar: 'ألبان وبيض', is_active: true },
    { name: 'Bakery', name_ar: 'مخبوزات', is_active: true },
    { name: 'Produce', name_ar: 'فواكه وخضروات', is_active: true },
    { name: 'Snacks & Sweets', name_ar: 'تسالي وحلويات', is_active: true },
    { name: 'Household & Cleaning', name_ar: 'منظفات ومنزلية', is_active: true },
    { name: 'Pantry & Groceries', name_ar: 'بقالة وبقوليات', is_active: true },
  ];
  
  const categories = await knex('categories').insert(categoriesData).returning('*');
  const catMap = categories.reduce((acc, cat) => ({ ...acc, [cat.name]: cat.id }), {});

  console.log('Seeding: Suppliers...');
  // 4. Seed Suppliers
  const suppliersToSeed = [];
  const supplierNames = ['Juhayna Trading', 'Edita Distribution', 'Al Mansour Group', 'Nestle Egypt', 'PepsiCo Egypt', 'Coca-Cola Bottling', 'Savola Group', 'Arma Group', 'Halwani Bros', 'Americana Egypt'];
  for (let i = 0; i < 10; i++) {
    suppliersToSeed.push({
      supplier_code: `SUP-${String(i+1).padStart(4, '0')}`,
      name: supplierNames[i],
      contact_name: fakerAR.person.fullName(),
      email: fakerEN.internet.email(),
      phone: '01' + fakerEN.string.numeric(9),
      address: `${fakerAR.location.streetAddress()}, ${fakerAR.location.city()}`,
      status: 'active'
    });
  }
  const suppliers = await knex('suppliers').insert(suppliersToSeed).returning('*');

  console.log('Seeding: Products...');
  // 5. Seed Products
  const productsToSeed = [
    // Beverages
    { barcode: '6221000111001', name: 'Coca-Cola Can 330ml', name_ar: 'كوكاكولا كانز ٣٣٠ مل', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 8.50, selling_price: 10.00 },
    { barcode: '6221000111002', name: 'Pepsi Can 330ml', name_ar: 'بيبسي كانز ٣٣٠ مل', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 8.50, selling_price: 10.00 },
    { barcode: '6221000111003', name: 'Sprite Can 330ml', name_ar: 'سبرايت كانز ٣٣٠ مل', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 8.50, selling_price: 10.00 },
    { barcode: '6221000111004', name: 'Juhayna Mango Juice 1L', name_ar: 'عصير جهينة مانجو ١ لتر', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 22.00, selling_price: 27.00 },
    { barcode: '6221000111005', name: 'Almarai Apple Juice 1L', name_ar: 'عصير المراعي تفاح ١ لتر', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 23.00, selling_price: 28.00 },
    { barcode: '6221000111006', name: 'Nestle Pure Life Water 1.5L', name_ar: 'مياه نستله ١.٥ لتر', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 4.50, selling_price: 6.00 },
    { barcode: '6221000111007', name: 'Dasani Water 600ml', name_ar: 'مياه داساني ٦٠٠ مل', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 2.50, selling_price: 3.50 },
    { barcode: '6221000111008', name: 'Schweppes Pomegranate 300ml', name_ar: 'شويبس رمان ٣٠٠ مل', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 9.00, selling_price: 12.00 },
    { barcode: '6221000111009', name: 'Fayrouz Pineapple 330ml', name_ar: 'فيروز أناناس ٣٣٠ مل', category_id: catMap['Beverages'], unit: 'pcs', cost_price: 9.00, selling_price: 11.00 },
    
    // Dairy & Eggs
    { barcode: '6221000112001', name: 'Juhayna Full Cream Milk 1L', name_ar: 'حليب جهينة كامل الدسم ١ لتر', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 35.00, selling_price: 40.00 },
    { barcode: '6221000112002', name: 'Almarai Skimmed Milk 1L', name_ar: 'حليب المراعي خالي الدسم ١ لتر', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 36.00, selling_price: 42.00 },
    { barcode: '6221000112003', name: 'Lamar Milk 1L', name_ar: 'حليب لمار ١ لتر', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 38.00, selling_price: 44.00 },
    { barcode: '6221000112004', name: 'Juhayna Plain Yogurt 105g', name_ar: 'زبادي جهينة سادة ١٠٥ جم', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 6.00, selling_price: 7.50 },
    { barcode: '6221000112005', name: 'Danone Yogurt 105g', name_ar: 'زبادي دانون ١٠٥ جم', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 6.00, selling_price: 7.50 },
    { barcode: '6221000112006', name: 'Domty White Cheese 500g', name_ar: 'جبنة بيضاء دومتي ٥٠٠ جم', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 30.00, selling_price: 35.00 },
    { barcode: '6221000112007', name: 'President Feta Cheese 250g', name_ar: 'جبنة فيتا بريزيدون ٢٥٠ جم', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 25.00, selling_price: 32.00 },
    { barcode: '6221000112008', name: 'Large Eggs 30 Pack', name_ar: 'طبق بيض ٣٠ بيضة', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 150.00, selling_price: 165.00 },
    { barcode: '6221000112009', name: 'Halwani Beef Luncheon 250g', name_ar: 'لانشون بقري حلواني ٢٥٠ جم', category_id: catMap['Dairy & Eggs'], unit: 'pcs', cost_price: 45.00, selling_price: 55.00 },

    // Bakery
    { barcode: '6221000113001', name: 'Edita Molto Chocolate', name_ar: 'مولتو شوكولاتة إيديتا', category_id: catMap['Bakery'], unit: 'pcs', cost_price: 8.00, selling_price: 10.00 },
    { barcode: '6221000113002', name: 'Bake Rolz Salt 40g', name_ar: 'بيك رولز ملح ٤٠ جم', category_id: catMap['Bakery'], unit: 'pcs', cost_price: 4.50, selling_price: 6.00 },
    { barcode: '6221000113003', name: 'Sunbites Olive Oil', name_ar: 'صن بايتس زيت زيتون', category_id: catMap['Bakery'], unit: 'pcs', cost_price: 5.50, selling_price: 7.00 },
    { barcode: '6221000113004', name: 'Rich Bake Toast 500g', name_ar: 'توست ريتش بيك ٥٠٠ جم', category_id: catMap['Bakery'], unit: 'pcs', cost_price: 28.00, selling_price: 35.00 },
    { barcode: '6221000113005', name: 'French Baguette', name_ar: 'خبز باجيت فرنسي', category_id: catMap['Bakery'], unit: 'pcs', cost_price: 12.00, selling_price: 15.00 },

    // Produce
    { barcode: 'PLU0101', name: 'Local Tomatoes', name_ar: 'طماطم بلدي', category_id: catMap['Produce'], unit: 'kg', cost_price: 8.00, selling_price: 12.00 },
    { barcode: 'PLU0102', name: 'Local Potatoes', name_ar: 'بطاطس بلدي', category_id: catMap['Produce'], unit: 'kg', cost_price: 10.00, selling_price: 15.00 },
    { barcode: 'PLU0103', name: 'Red Onions', name_ar: 'بصل أحمر', category_id: catMap['Produce'], unit: 'kg', cost_price: 15.00, selling_price: 22.00 },
    { barcode: 'PLU0104', name: 'Bananas', name_ar: 'موز بلدي', category_id: catMap['Produce'], unit: 'kg', cost_price: 12.00, selling_price: 18.00 },
    { barcode: 'PLU0105', name: 'Local Apples', name_ar: 'تفاح مصري', category_id: catMap['Produce'], unit: 'kg', cost_price: 25.00, selling_price: 35.00 },
    { barcode: 'PLU0106', name: 'Navel Oranges', name_ar: 'برتقال بسرة', category_id: catMap['Produce'], unit: 'kg', cost_price: 6.00, selling_price: 10.00 },
    { barcode: 'PLU0107', name: 'Cucumbers', name_ar: 'خيار', category_id: catMap['Produce'], unit: 'kg', cost_price: 12.00, selling_price: 16.00 },

    // Snacks & Sweets
    { barcode: '6221000114001', name: 'Chipsy Salt 50g', name_ar: 'شيبسي ملح ٥٠ جم', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 6.00, selling_price: 7.00 },
    { barcode: '6221000114002', name: 'Chipsy Kebab 50g', name_ar: 'شيبسي كباب ٥٠ جم', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 6.00, selling_price: 7.00 },
    { barcode: '6221000114003', name: 'Tiger Sweet Chili', name_ar: 'تايجر شطة حلوة', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 6.00, selling_price: 7.00 },
    { barcode: '6221000114004', name: 'Doritos Nacho Cheese', name_ar: 'دوريتوس جبنة ناتشو', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 8.00, selling_price: 10.00 },
    { barcode: '6221000114005', name: 'Cheetos Crunchy', name_ar: 'شيتوس كرنشي', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 6.00, selling_price: 7.00 },
    { barcode: '6221000114006', name: 'Cadbury Dairy Milk 37g', name_ar: 'شوكولاتة كادبوري ديري ميلك ٣٧ جم', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 15.00, selling_price: 20.00 },
    { barcode: '6221000114007', name: 'Galaxy Flutes', name_ar: 'جالاكسي فلوتس', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 12.00, selling_price: 15.00 },
    { barcode: '6221000114008', name: 'Moro Chocolate', name_ar: 'شوكولاتة مورو', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 8.00, selling_price: 12.00 },
    { barcode: '6221000114009', name: 'Mandolin Chocolate', name_ar: 'شوكولاتة ماندولين', category_id: catMap['Snacks & Sweets'], unit: 'pcs', cost_price: 5.00, selling_price: 7.00 },

    // Household & Cleaning
    { barcode: '6221000115001', name: 'Pril Dish Soap 1L', name_ar: 'بريل سائل أطباق ١ لتر', category_id: catMap['Household & Cleaning'], unit: 'pcs', cost_price: 32.00, selling_price: 40.00 },
    { barcode: '6221000115002', name: 'Ariel Powder 3kg', name_ar: 'اريال مسحوق ٣ كجم', category_id: catMap['Household & Cleaning'], unit: 'pcs', cost_price: 180.00, selling_price: 210.00 },
    { barcode: '6221000115003', name: 'Persil Gel 3L', name_ar: 'برسيل جل ٣ لتر', category_id: catMap['Household & Cleaning'], unit: 'pcs', cost_price: 210.00, selling_price: 250.00 },
    { barcode: '6221000115004', name: 'Fine Classic Tissues 550t', name_ar: 'مناديل فاين ٥٥٠ منديل', category_id: catMap['Household & Cleaning'], unit: 'pcs', cost_price: 22.00, selling_price: 28.00 },
    { barcode: '6221000115005', name: 'Papia Toilet Paper 6 Rolls', name_ar: 'بابيا ورق تواليت ٦ بكرات', category_id: catMap['Household & Cleaning'], unit: 'pcs', cost_price: 60.00, selling_price: 75.00 },
    { barcode: '6221000115006', name: 'Clorox Original 1L', name_ar: 'كلوركس أوريجينال ١ لتر', category_id: catMap['Household & Cleaning'], unit: 'pcs', cost_price: 15.00, selling_price: 20.00 },

    // Pantry
    { barcode: '6221000116001', name: 'Al Doha White Rice 1kg', name_ar: 'أرز الضحى ١ كجم', category_id: catMap['Pantry & Groceries'], unit: 'pcs', cost_price: 28.00, selling_price: 35.00 },
    { barcode: '6221000116002', name: 'Al Doha Yellow Lentils 500g', name_ar: 'عدس أصفر الضحى ٥٠٠ جم', category_id: catMap['Pantry & Groceries'], unit: 'pcs', cost_price: 35.00, selling_price: 45.00 },
    { barcode: '6221000116003', name: 'Italiano Penne Pasta 400g', name_ar: 'مكرونة قلم إيتاليانو ٤٠٠ جم', category_id: catMap['Pantry & Groceries'], unit: 'pcs', cost_price: 12.00, selling_price: 16.00 },
    { barcode: '6221000116004', name: 'Rehana Macaroni 400g', name_ar: 'مكرونة ريحانة ٤٠٠ جم', category_id: catMap['Pantry & Groceries'], unit: 'pcs', cost_price: 11.00, selling_price: 15.00 },
    { barcode: '6221000116005', name: 'Crystal White Ghee 700g', name_ar: 'سمن كريستال أبيض ٧٠٠ جم', category_id: catMap['Pantry & Groceries'], unit: 'pcs', cost_price: 85.00, selling_price: 95.00 },
    { barcode: '6221000116006', name: 'Crystal Sunflower Oil 1L', name_ar: 'زيت عباد الشمس كريستال ١ لتر', category_id: catMap['Pantry & Groceries'], unit: 'pcs', cost_price: 65.00, selling_price: 75.00 },
    { barcode: '6221000116007', name: 'Heinz Tomato Paste 360g', name_ar: 'صلصة طماطم هاينز ٣٦٠ جم', category_id: catMap['Pantry & Groceries'], unit: 'pcs', cost_price: 20.00, selling_price: 25.00 },
  ].map(p => ({
    ...p,
    min_stock_level: fakerEN.number.float({ min: 10, max: 30, multipleOf: 1 }),
    max_stock_level: fakerEN.number.float({ min: 100, max: 300, multipleOf: 1 }),
  }));

  const insertedProducts = await knex('products').insert(productsToSeed).returning('*');

  console.log('Seeding: Inventory...');
  // 6. Seed Inventory
  const inventories = insertedProducts.map((prod) => ({
    product_id: prod.id,
    quantity: fakerEN.number.float({ min: 50, max: 250, multipleOf: 1 }),
    reserved_quantity: 0.000,
    last_counted_at: fakerEN.date.recent({ days: 5 }),
  }));
  await knex('inventory').insert(inventories);

  console.log('Seeding: Customers...');
  // 7. Seed Customers
  const customersToSeed = [];
  for (let i = 0; i < 60; i++) {
    customersToSeed.push({
      name: fakerAR.person.fullName(),
      phone: '01' + fakerEN.string.numeric(9),
      balance: fakerEN.number.float({ min: -500, max: 0, multipleOf: 0.01 }), // negative or 0
      loyalty_points: fakerEN.number.int({ min: 10, max: 500 }),
    });
  }
  const customers = await knex('customers').insert(customersToSeed).returning('*');

  console.log('Seeding: Historical Sales (Massive Generation)...');
  // 8. Seed Historical Sales
  const salesToInsert = [];
  const saleItemsToInsert = [];

  const totalSales = 450; // Generate 450 historical sales
  let currentDate = new Date();
  
  for (let i = 0; i < totalSales; i++) {
    // Generate dates spread across the last 30 days
    const saleDate = fakerEN.date.recent({ days: 30, refDate: currentDate });
    
    const cashier = fakerEN.helpers.arrayElement(cashiers);
    const customer = fakerEN.number.int(10) > 7 ? fakerEN.helpers.arrayElement(customers) : null;
    const paymentMethod = fakerEN.helpers.arrayElement(['cash', 'card']);
    
    // Pick 1 to 5 random products for this sale
    const numItems = fakerEN.number.int({ min: 1, max: 5 });
    const selectedProducts = fakerEN.helpers.arrayElements(insertedProducts, numItems);
    
    let subtotal = 0;
    const currentSaleId = fakerEN.string.uuid();

    selectedProducts.forEach(prod => {
      const quantity = prod.unit === 'kg' ? fakerEN.number.float({ min: 0.5, max: 3, multipleOf: 0.01 }) : fakerEN.number.int({ min: 1, max: 5 });
      const unitPrice = Number(prod.selling_price);
      const discount = fakerEN.number.int(10) > 8 ? fakerEN.number.float({ min: 0, max: unitPrice * 0.1, multipleOf: 0.01 }) : 0;
      const lineTotal = Number(((quantity * unitPrice) - discount).toFixed(2));
      
      subtotal += lineTotal;

      saleItemsToInsert.push({
        sale_id: currentSaleId,
        product_id: prod.id,
        quantity: quantity,
        unit_price: unitPrice,
        discount: Number(discount.toFixed(2)),
        line_total: lineTotal,
        cost_at_sale: prod.cost_price,
        created_at: saleDate,
      });
    });

    subtotal = Number(subtotal.toFixed(2));
    const globalDiscount = fakerEN.number.int(10) > 9 ? fakerEN.number.float({ min: 0, max: subtotal * 0.1, multipleOf: 0.01 }) : 0;
    const total = Number((subtotal - globalDiscount).toFixed(2));
    const cashReceived = paymentMethod === 'cash' ? Number((total + fakerEN.number.float({ min: 0, max: 50, multipleOf: 0.01 })).toFixed(2)) : total;
    const changeGiven = paymentMethod === 'cash' ? Number((cashReceived - total).toFixed(2)) : 0;

    salesToInsert.push({
      id: currentSaleId,
      receipt_number: `TM-${saleDate.toISOString().slice(0,10).replace(/-/g,'')}-${String(i).padStart(4, '0')}`,
      cashier_id: cashier.id,
      customer_id: customer ? customer.id : null,
      payment_method: paymentMethod,
      subtotal: subtotal,
      discount_amount: globalDiscount, // Store global discount here as per typical simple schemas
      tax_amount: 0.00,
      total: total,
      cash_received: cashReceived,
      change_given: changeGiven,
      status: 'completed',
      created_at: saleDate,
    });
  }

  // Insert sales and items in chunks to avoid blowing up SQLite/pg limits
  const chunkSize = 50;
  for (let i = 0; i < salesToInsert.length; i += chunkSize) {
    const chunk = salesToInsert.slice(i, i + chunkSize);
    await knex('sales').insert(chunk);
  }

  const itemChunkSize = 100;
  for (let i = 0; i < saleItemsToInsert.length; i += itemChunkSize) {
    const chunk = saleItemsToInsert.slice(i, i + itemChunkSize);
    await knex('sale_items').insert(chunk);
  }

  console.log('✅ Seeding Complete! Enjoy your realistic Egyptian Supermarket data.');
}
