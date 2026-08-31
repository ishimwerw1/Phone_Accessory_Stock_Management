require('dotenv').config();
const connectDB = require('./config/db');
const {
  Sale, Product, Customer, Supplier, Payment, Loan, LoanPayment,
  StockTransaction, AuditLog, Notification, Counter, PhoneModel, User,
} = require('./models');

async function main() {
  await connectDB();
  console.log('Resetting demo data (all business records)...');
  await Promise.all([
    Sale.deleteMany({}),
    Product.deleteMany({}),
    Customer.deleteMany({}),
    Supplier.deleteMany({}),
    Payment.deleteMany({}),
    Loan.deleteMany({}),
    LoanPayment.deleteMany({}),
    StockTransaction.deleteMany({}),
    AuditLog.deleteMany({}),
    Notification.deleteMany({}),
    Counter.deleteMany({}),
  ]);
  // Keep the 3 demo staff users for convenience; remove any users we created before
  console.log('Cleared sales, products, customers, suppliers, payments, loans, stock, audit, notifications & counters.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
