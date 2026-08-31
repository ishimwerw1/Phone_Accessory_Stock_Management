require('dotenv').config();
const connectDB = require('./config/db');
const {
  User, Brand, Category, Setting, PhoneModel, Supplier, Customer,
  Product, Sale, Loan, Payment, StockTransaction, Counter,
} = require('./models');
const { nextNumber } = require('./utils/helpers');
const { createSale } = require('./services/saleService');
const { notify } = require('./services/notificationService');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAdmin() {
  const admin = await User.findOne({ role: 'SUPER_ADMIN' });
  return { _id: admin._id, name: admin.name, role: admin.role, email: admin.email };
}

async function ensureUsers() {
  const created = [];
  const specs = [
    { name: 'Kevin Mugisha', email: 'cashier@stock.com', password: 'cashier123', role: 'CASHIER' },
    { name: 'Alice Uwase', email: 'storekeeper@stock.com', password: 'store123', role: 'STOREKEEPER' },
    { name: 'Eric Niyonsaba', email: 'manager@stock.com', password: 'manager123', role: 'MANAGER' },
  ];
  for (const s of specs) {
    const existing = await User.findOne({ email: s.email });
    if (existing) { created.push(existing); continue; }
    const u = await User.create(s);
    created.push(u);
    console.log(`  + User ${u.name} (${u.role}) → ${u.email}`);
  }
  return created;
}

async function ensureCharts() {
  const [brands, cats, models, suppliers, customers] = await Promise.all([
    Brand.find({}).sort('name'),
    Category.find({}), // includes subcategories
    PhoneModel.find({}).populate('brand'),
    Supplier.find({}).sort('name'),
    Customer.find({}).sort('name'),
  ]);
  return { brands, cats, models, suppliers, customers };
}

async function seedProducts(admin, { brands, cats, models, suppliers }) {
  if (await Product.countDocuments()) {
    console.log('  (products already exist — skipping)');
    return;
  }
  const catByName = (name) => cats.find((c) => c.name === name);
  const subByName = (name) => cats.find((c) => c.name === name && c.parent);
  const byBrandName = (name) => brands.find((b) => b.name.toLowerCase() === name.toLowerCase());
  const bySupplier = (name) => suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
  const modelsOf = (...names) => models.filter((m) => names.some((n) => m.brand?.name.toLowerCase() === n.toLowerCase())).map((m) => m._id);

  const list = [
    { name: 'LCD Screen Samsung Galaxy A52', partType: 'LCD', condition: 'NEW', category: catByName('Screens'), subcategory: subByName('LCD'), brand: byBrandName('Samsung'), models: modelsOf('Samsung'), buyingPrice: 12000, sellingPrice: 20000, quantity: 20, minStock: 5, location: 'A1' },
    { name: 'OLED Screen iPhone 11', partType: 'OLED', condition: 'ORIGINAL', category: catByName('Screens'), subcategory: subByName('OLED'), brand: byBrandName('Apple'), models: modelsOf('Apple'), buyingPrice: 35000, sellingPrice: 55000, quantity: 8, minStock: 3, location: 'A2' },
    { name: 'AMOLED Screen Redmi Note 11', partType: 'AMOLED', condition: 'NEW', category: catByName('Screens'), subcategory: subByName('AMOLED'), brand: byBrandName('Redmi'), models: modelsOf('Redmi'), buyingPrice: 15000, sellingPrice: 25000, quantity: 15, minStock: 4, location: 'A3' },
    { name: 'Touch Screen Tecno Spark 9', partType: 'Touch', condition: 'COMPATIBLE', category: catByName('Screens'), subcategory: subByName('Touch Screen'), brand: byBrandName('Tecno'), models: modelsOf('Tecno'), buyingPrice: 6000, sellingPrice: 11000, quantity: 12, minStock: 4, location: 'A4' },

    { name: 'Battery Samsung A52', partType: 'Battery', condition: 'ORIGINAL', category: catByName('Batteries'), brand: byBrandName('Samsung'), models: modelsOf('Samsung'), buyingPrice: 9000, sellingPrice: 16000, quantity: 30, minStock: 8, location: 'B1' },
    { name: 'Battery iPhone 11', partType: 'Battery', condition: 'ORIGINAL', category: catByName('Batteries'), brand: byBrandName('Apple'), models: modelsOf('Apple'), buyingPrice: 14000, sellingPrice: 24000, quantity: 10, minStock: 4, location: 'B2' },
    { name: 'Battery Infinix Hot 11', partType: 'Battery', condition: 'COMPATIBLE', category: catByName('Batteries'), brand: byBrandName('Infinix'), models: modelsOf('Infinix'), buyingPrice: 5000, sellingPrice: 9500, quantity: 25, minStock: 6, location: 'B3' },

    { name: 'Backdoor Samsung A12', partType: 'Backdoor', condition: 'OEM', category: catByName('Backdoors'), subcategory: subByName('OEM'), brand: byBrandName('Samsung'), models: modelsOf('Samsung'), buyingPrice: 3500, sellingPrice: 6500, quantity: 18, minStock: 5, location: 'C1' },
    { name: 'Backdoor iPhone 13 Original', partType: 'Backdoor', condition: 'ORIGINAL', category: catByName('Backdoors'), subcategory: subByName('Original'), brand: byBrandName('Apple'), models: modelsOf('Apple'), buyingPrice: 8000, sellingPrice: 15000, quantity: 6, minStock: 3, location: 'C2' },

    { name: 'Charging Port Type-C Samsung', partType: 'Charging Port', condition: 'OEM', category: catByName('Charging Parts'), subcategory: subByName('Charging Ports'), brand: byBrandName('Samsung'), models: modelsOf('Samsung'), buyingPrice: 3000, sellingPrice: 6000, quantity: 40, minStock: 10, location: 'D1' },
    { name: 'Micro USB Charging Flex', partType: 'Charging Flex', condition: 'COMPATIBLE', category: catByName('Charging Parts'), subcategory: subByName('Charging Flex'), models: modelsOf('Tecno', 'Infinix', 'itel'), buyingPrice: 1500, sellingPrice: 3500, quantity: 50, minStock: 12, location: 'D2' },

    { name: 'Rear Camera Samsung A52', partType: 'Rear Camera', condition: 'ORIGINAL', category: catByName('Camera Parts'), subcategory: subByName('Rear Camera'), brand: byBrandName('Samsung'), models: modelsOf('Samsung'), buyingPrice: 7000, sellingPrice: 13000, quantity: 9, minStock: 3, location: 'E1' },
    { name: 'Front Camera iPhone 11', partType: 'Front Camera', condition: 'OEM', category: catByName('Camera Parts'), subcategory: subByName('Front Camera'), brand: byBrandName('Apple'), models: modelsOf('Apple'), buyingPrice: 6000, sellingPrice: 12000, quantity: 7, minStock: 3, location: 'E2' },

    { name: 'Speaker Samsung A12', partType: 'Speaker', condition: 'OEM', category: catByName('Audio Parts'), subcategory: subByName('Speaker'), brand: byBrandName('Samsung'), models: modelsOf('Samsung'), buyingPrice: 2000, sellingPrice: 4500, quantity: 22, minStock: 6, location: 'F1' },

    { name: 'Fast Charger 65W Type-C', partType: 'Charger', condition: 'NEW', category: catByName('Accessories'), subcategory: subByName('Chargers'), models: modelsOf('Samsung', 'Xiaomi', 'Redmi'), buyingPrice: 4500, sellingPrice: 9000, quantity: 35, minStock: 8, location: 'G1' },
    { name: 'USB-C Cable 1m', partType: 'Cable', condition: 'NEW', category: catByName('Accessories'), subcategory: subByName('Cables'), models: modelsOf('Samsung', 'Apple', 'Tecno'), buyingPrice: 1000, sellingPrice: 2500, quantity: 60, minStock: 15, location: 'G2' },
    { name: 'iPhone 11 Tempered Glass', partType: 'Screen Protector', condition: 'NEW', category: catByName('Accessories'), subcategory: subByName('Screen Protectors'), brand: byBrandName('Apple'), models: modelsOf('Apple'), buyingPrice: 800, sellingPrice: 2000, quantity: 45, minStock: 10, location: 'G3' },
    { name: 'Universal Earphones', partType: 'Earphones', condition: 'NEW', category: catByName('Accessories'), subcategory: subByName('Earphones'), models: modelsOf('Tecno', 'Infinix', 'itel'), buyingPrice: 1500, sellingPrice: 4000, quantity: 28, minStock: 8, location: 'G4' },

    { name: 'Precision Screwdriver Set', partType: 'Tool', condition: 'NEW', category: catByName('Tools'), subcategory: subByName('Screwdrivers'), buyingPrice: 4000, sellingPrice: 8000, quantity: 5, minStock: 2, location: 'H1' },
    { name: 'Phone Opening Tool Kit', partType: 'Tool', condition: 'NEW', category: catByName('Tools'), subcategory: subByName('Opening Tools'), buyingPrice: 3500, sellingPrice: 7000, quantity: 8, minStock: 2, location: 'H2' },
  ];

  let created = 0;
  for (const item of list) {
    const sku = await nextNumber('SP');
    const supplier = item.name.includes('Screen') || item.name.includes('Charger') ? bySupplier('Kigali Phone Parts') : bySupplier('Tech Vision Limited');
    const product = await Product.create({
      name: item.name,
      sku,
      category: item.category?._id,
      subcategory: item.subcategory?._id,
      brand: item.brand?._id,
      compatibleModels: item.models || [],
      partType: item.partType,
      condition: item.condition,
      description: `${item.partType} for mobile repair — ${item.condition.toLowerCase()} quality`,
      buyingPrice: item.buyingPrice,
      sellingPrice: item.sellingPrice,
      quantity: item.quantity,
      minStock: item.minStock,
      supplier: supplier?._id,
      location: item.location,
      status: 'ACTIVE',
    });
    await StockTransaction.create({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      type: 'OPENING_STOCK',
      quantity: product.quantity,
      prevQuantity: 0,
      newQuantity: product.quantity,
      reason: 'Opening stock (demo data)',
      reference: 'OPEN',
      performedBy: admin._id,
    });
    created++;
  }
  console.log(`  + Created ${created} sample products with opening stock`);
}

async function ensureBaseReferential(admin) {
  const suppliers = await Supplier.find({}).sort('name');
  const customers = await Customer.find({}).sort('name');
  const products = await Product.find({}).select('_id name sku buyingPrice sellingPrice quantity partType condition brand').populate('brand', 'name').populate('compatibleModels', 'name');
  return { suppliers, customers, products };
}

async function seedCustomers(admin) {
  if (await Customer.countDocuments()) {
    console.log('  (customers already exist — skipping)');
    return;
  }
  const sample = [
    { name: 'Jean Paul Habimana', phone: '0788123456', email: 'jphabimana@gmail.com', address: 'Kicukiro, Kigali' },
    { name: 'Claudine Mukamana', phone: '0722987654', email: 'cmukamana@yahoo.com', address: 'Nyamirambo, Kigali' },
    { name: 'Patrick Nshimiyimana', phone: '0733556677', email: 'patrick.nshimi@outlook.com', address: 'Kimironko, Kigali' },
    { name: 'Diane Ingabire', phone: '0780456789', email: 'dingabire@gmail.com', address: 'Remera, Kigali' },
    { name: 'Samuel Uwimana', phone: '0726123456', email: 'suwimana@gmail.com', address: 'Gisozi, Kigali' },
    { name: 'Grace Nyirahabimana', phone: '0790345678', email: 'gnyira@gmail.com', address: 'Kacyiru, Kigali' },
    { name: 'Olivier Kagabo', phone: '0788123987', email: 'okagabo@gmail.com', address: 'Gikondo, Kigali' },
    { name: 'Josiane Umuhoza', phone: '0721778899', email: 'jumuhoza@gmail.com', address: 'Nyarutarama, Kigali' },
  ];
  const rows = await Customer.insertMany(sample);
  console.log(`  + Created ${rows.length} sample customers`);
  return rows;
}

async function seedSales(admin) {
  if (await Sale.countDocuments()) {
    console.log('  (sales already exist — skipping)');
    return;
  }
  const { products } = await ensureBaseReferential(admin);
  if (!products.length) { console.log('  (no products to make sales — skipping)'); return; }
  const cashiers = await User.find({ role: 'CASHIER' });
  const cashier = cashiers[0] || admin;
  const customers = await Customer.find({});

  const pickCustomer = () => { if (!customers.length) return undefined; return customers[Math.floor(Math.random() * customers.length)]; };
  const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

  // Build a series of sales spread over ~30 days so the trend chart is interesting.
  let count = 0;
  for (let ago = 28; ago >= 0; ago -= 2) {
    const nSales = 1 + Math.floor(Math.random() * 3); // 1-3 sales per 2-day bucket
    for (let s = 0; s < nSales; s++) {
      const k = 1 + Math.floor(Math.random() * 3); // 1-3 line items
      const chosen = [];
      let subtotal = 0;
      for (let i = 0; i < k; i++) {
        const p = products[Math.floor(Math.random() * products.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        chosen.push({ productId: p._id, quantity: qty, price: p.sellingPrice });
        subtotal += qty * p.sellingPrice;
      }
      const discount = [0, 0, 500, 1000][Math.floor(Math.random() * 4)];
      const total = subtotal - discount;
      const anyLoan = Math.random() < 0.3;
      const paymentMethod = anyLoan ? 'LOAN' : (['CASH', 'CASH', 'MOMO', 'BANK'][Math.floor(Math.random() * 4)]);

      // Compute amountPaid ourselves: loans pay a small deposit or nothing; others mostly pay in full.
      let amountPaid;
      if (anyLoan) amountPaid = Math.random() < 0.5 ? 0 : Math.round(total * (0.2 + Math.random() * 0.3));
      else amountPaid = Math.random() < 0.85 ? total : Math.round(total * 0.5);

      const itemInput = chosen.map(({ productId, quantity, price }) => ({ productId, quantity, price }));
      const customer = pickCustomer();
      try {
        const created = await createSale(
          {
            items: itemInput,
            discount,
            paymentMethod,
            amountPaid,
            customer: anyLoan && customer ? { _id: customer._id } : undefined,
            dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            notes: 'Demo sale data',
          },
          { _id: cashier._id }
        );
        await Sale.updateOne({ _id: created.sale._id }, { createdAt: daysAgo(ago), updatedAt: daysAgo(ago) });
        if (created.loan) await Loan.updateOne({ _id: created.loan._id }, { date: daysAgo(ago), createdAt: daysAgo(ago) });
        count++;
      } catch (e) {
        console.log(`    (skipped a demo sale: ${e.message})`);
      }
    }
  }
  console.log(`  + Created ${count} sample sales over the last month`);
}

async function seedPayments(admin) {
  const loans = await Loan.find({ status: { $in: ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE'] } }).limit(8);
  const customers = await Customer.find({});
  if (!loans.length || !customers.length) return;
  const { products } = await ensureBaseReferential(admin);
  let made = 0;
  for (const loan of loans) {
    if (loan.amountPaid >= loan.totalAmount) continue;
    const amount = Math.min(loan.outstanding, Math.floor(loan.outstanding * (0.3 + Math.random() * 0.6)));
    if (amount <= 0) continue;
    const previous = loan.outstanding;
    const newOutstanding = loan.outstanding - amount;
    loan.amountPaid += amount;
    loan.outstanding = newOutstanding;
    loan.status = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    await loan.save();
    await Payment.create({
      paymentNumber: await nextNumber('PAY'),
      sale: loan.sale,
      loan: loan._id,
      customer: loan.customer,
      method: 'CASH',
      amount,
      status: 'PAID',
      receivedBy: admin._id,
    });
    made++;
  }
  if (made) console.log(`  + Created ${made} loan repayments`);
}

async function seedSuppliers() {
  if (await Supplier.countDocuments()) {
    console.log('  (suppliers already exist — skipping)');
    return;
  }
  const sample = [
    { name: 'Kigali Phone Parts', company: 'KPP Ltd', phone: '0788000001', email: 'sales@kpp.rw', address: 'Kigali, Nyarugenge' },
    { name: 'Tech Vision Limited', company: 'TVL', phone: '0722000002', email: 'info@techvision.rw', address: 'Kigali, Kicukiro' },
    { name: 'Global Spare Parts', company: 'GSP International', phone: '0733000003', email: 'order@globalspares.com', address: 'Dubai, UAE' },
    { name: 'Mobile Parts Rwanda', company: 'MPR', phone: '0799000004', email: 'contact@mparts.rw', address: 'Huye, Rwanda' },
  ];
  const rows = await Supplier.insertMany(sample);
  console.log(`  + Created ${rows.length} sample suppliers`);
}

async function main() {
  await connectDB();
  console.log('Seeding demo data...\n');

  // Only run the full demo seed when the system is essentially fresh (no sales yet).
  if (await Sale.countDocuments()) {
    console.log('Sales already exist — demo data seed skipped (run `node seedDemo.js --force` to reset).');
    process.exit(0);
  }

  const admin = await getAdmin();
  console.log('· Users (cashier / storekeeper / manager)');
  const staff = await ensureUsers();

  console.log('· Suppliers');
  await seedSuppliers();

  console.log('· Customers');
  const customers = await seedCustomers(admin);

  const { brands, cats, models } = await ensureCharts();

  console.log('· Products + opening stock');
  await seedProducts(admin, { brands, cats, models, suppliers: await Supplier.find() });

  console.log('· Sales (last 30 days, mixed Cash/MoMo/Bank/Loan)');
  await seedSales(admin);

  console.log('· Loan repayments');
  await seedPayments(admin);

  console.log('\nPartial payments mapped to loan customers.');
  console.log('\n✅ Demo data seeding complete!');
  console.log('\nExtra demo logins:');
  console.log('  cashier@stock.com    / cashier123');
  console.log('  storekeeper@stock.com / store123');
  console.log('  manager@stock.com    / manager123');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
