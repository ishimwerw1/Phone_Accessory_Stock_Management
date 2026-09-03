const { Customer, Sale, Payment, Loan, LoanPayment, Product } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: re }, { phone: re }, { email: re }];
  }
  const customers = await Customer.find(filter).sort('-createdAt').limit(500);
  const ids = customers.map((c) => c._id);
  const saleTotals = await Sale.aggregate([
    { $match: { customer: { $in: ids }, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: '$customer', total: { $sum: '$total' } } },
  ]);
  const saleById = {};
  saleTotals.forEach((t) => { saleById[String(t._id)] = t; });
  const paymentTotals = await Payment.aggregate([
    { $match: { customer: { $in: ids }, status: 'PAID' } },
    { $group: { _id: '$customer', paid: { $sum: '$amount' } } },
  ]);
  const paymentById = {};
  paymentTotals.forEach((p) => { paymentById[String(p._id)] = p; });
  const loans = await Loan.aggregate([
    { $match: { customer: { $in: ids }, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: '$customer', debt: { $sum: '$outstanding' }, count: { $sum: 1 } } },
  ]);
  const loanMap = {};
  loans.forEach((l) => { loanMap[String(l._id)] = l; });
  success(res, 'Customers', customers.map((c) => {
    const cid = String(c._id);
    const purchases = saleById[cid]?.total || 0;
    const paid = paymentById[cid]?.paid || 0;
    const debt = loanMap[cid]?.debt || 0;
    const outstanding = Math.max(purchases - paid, debt);
    return {
      ...c.toObject(),
      totalPurchases: purchases,
      totalPaid: paid,
      outstanding,
      activeLoans: loanMap[cid]?.count || 0,
    };
  }));
});

exports.getOne = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return error(res, 'Customer not found', 404);
  const sales = await Sale.find({ customer: customer._id }).sort('-createdAt');
  const payments = await Payment.find({ customer: customer._id }).sort('-date');
  const loans = await Loan.find({ customer: customer._id, status: { $ne: 'CANCELLED' } })
    .populate('sale', 'saleNumber items')
    .sort('-date');
  const repayments = await LoanPayment.find({ customer: customer._id }).sort('-date');
  const totalPurchase = sales.filter((s) => s.status !== 'CANCELLED').reduce((a, s) => a + s.total, 0);
  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0);
  const loanOutstanding = loans.reduce((a, l) => a + l.outstanding, 0);
  const outstanding = Math.max(totalPurchase - totalPaid, loanOutstanding);
  success(res, 'Customer detail', {
    customer,
    stats: { totalPurchase, totalPaid, outstanding, salesCount: sales.filter((s) => s.status !== 'CANCELLED').length, loansCount: loans.length },
    sales, payments, loans, repayments,
  });
});

exports.create = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (!name) return error(res, 'Customer name is required');
  const existing = phone ? await Customer.findOne({ phone }) : null;
  if (existing) {
    return success(res, 'Customer already exists', { customer: existing, existing: true });
  }
  const customer = await Customer.create(req.body);
  await audit(req, 'CUSTOMER_CREATED', 'Customer', customer._id, { name: customer.name, phone: customer.phone });
  success(res, 'Customer created', { customer, existing: false }, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!customer) return error(res, 'Customer not found', 404);
  await audit(req, 'CUSTOMER_UPDATED', 'Customer', req.params.id, req.body);
  success(res, 'Customer updated', customer);
});

exports.remove = asyncHandler(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.params.id, { status: 'INACTIVE' }, { new: true });
  if (!customer) return error(res, 'Customer not found', 404);
  await audit(req, 'CUSTOMER_DEACTIVATED', 'Customer', req.params.id, { name: customer.name });
  success(res, 'Customer deactivated');
});