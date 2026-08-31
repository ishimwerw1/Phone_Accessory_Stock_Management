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
  const [totals] = await Sale.aggregate([
    { $match: { customer: { $in: ids }, status: 'COMPLETED' } },
    { $group: { _id: '$customer', total: { $sum: '$total' }, paid: { $sum: '$amountPaid' } } },
  ]);
  const byId = {};
  if (totals) byId[String(totals._id)] = totals;
  const loans = await Loan.aggregate([
    { $match: { customer: { $in: ids }, status: { $ne: 'CANCELLED' } } },
    { $group: { _id: '$customer', debt: { $sum: '$outstanding' }, count: { $sum: 1 } } },
  ]);
  const loanMap = {};
  loans.forEach((l) => { loanMap[String(l._id)] = l; });
  success(res, 'Customers', customers.map((c) => ({
    ...c.toObject(),
    totalPurchases: byId[String(c._id)]?.total || 0,
    totalPaid: byId[String(c._id)]?.paid || 0,
    outstanding: loanMap[String(c._id)]?.debt || 0,
    activeLoans: loanMap[String(c._id)]?.count || 0,
  })));
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
  const totalPaid = repayments.reduce((a, p) => a + p.amount, 0) + payments.filter((p) => p.sale).reduce((a, p) => a + p.amount, 0);
  const outstanding = loans.reduce((a, l) => a + l.outstanding, 0);
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