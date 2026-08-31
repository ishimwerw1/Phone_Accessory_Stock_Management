const { Sale, Payment, Loan } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { createSale, cancelSale } = require('../services/saleService');

exports.create = asyncHandler(async (req, res) => {
  const result = await createSale(req.body, req.user);
  success(res, 'Sale completed successfully', result, 201);
});

exports.getAll = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20, from, to, customer, cashier, paymentMethod, paymentStatus } = req.query;
  const filter = {};
  if (from || to) filter.createdAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59') }) };
  if (customer) filter.customer = customer;
  if (cashier) filter.cashier = cashier;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ saleNumber: re }, { customerName: re }];
  }
  const total = await Sale.countDocuments(filter);
  const sales = await Sale.find(filter)
    .populate('customer', 'name phone')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  success(res, 'Sales', { sales, total, page: Number(page), limit: Number(limit) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('cashier', 'name');
  if (!sale) return error(res, 'Sale not found', 404);
  const loan = await Loan.findOne({ sale: sale._id });
  success(res, 'Sale', { sale, loan: loan || null });
});

exports.cancel = asyncHandler(async (req, res) => {
  await cancelSale(req.params.id, req.user);
  success(res, 'Sale cancelled — stock restored');
});

exports.invoice = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('cashier', 'name');
  if (!sale) return error(res, 'Sale not found', 404);
  const loan = await Loan.findOne({ sale: sale._id });
  const settings = require('../models/Setting');
  const s = {};
  for (const row of await settings.find()) s[row.key] = row.value;
  success(res, 'Invoice', { sale, loan, settings: s });
});