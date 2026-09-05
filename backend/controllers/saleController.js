const { Sale, Payment, Loan } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { createSale, createOnDemandSale, cancelSale } = require('../services/saleService');

exports.create = asyncHandler(async (req, res) => {
  const result = await createSale(req.body, req.user);
  success(res, 'Sale completed successfully', result, 201);
});

exports.createOnDemand = asyncHandler(async (req, res) => {
  const result = await createOnDemandSale(req.body, req.user);
  success(res, 'On-demand sale completed successfully', result, 201);
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
  const saleIds = sales.map((s) => s._id);
  const paidBySale = {};
  if (saleIds.length > 0) {
    const paymentAgg = await Payment.aggregate([
      { $match: { sale: { $in: saleIds }, status: 'PAID' } },
      { $group: { _id: '$sale', paid: { $sum: '$amount' } } },
    ]);
    paymentAgg.forEach((r) => { paidBySale[String(r._id)] = r.paid; });
  }
  const salesWithPaid = sales.map((s) => {
    const paid = paidBySale[String(s._id)] || 0;
    const outstanding = s.status === 'CANCELLED' ? 0 : Math.max(0, (s.total || 0) - paid);
    const pStatus = outstanding <= 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
    const obj = s.toObject();
    return {
      ...obj,
      amountPaid: paid,
      outstanding,
      paymentStatus: s.status === 'CANCELLED' ? 'CANCELLED' : pStatus,
    };
  });
  success(res, 'Sales', { sales: salesWithPaid, total, page: Number(page), limit: Number(limit) });
});

const enrichSale = async (saleDoc) => {
  const paidAgg = await Payment.aggregate([
    { $match: { sale: saleDoc._id, status: 'PAID' } },
    { $group: { _id: '$sale', paid: { $sum: '$amount' } } },
  ]);
  const paid = paidAgg[0]?.paid || 0;
  const outstanding = saleDoc.status === 'CANCELLED' ? 0 : Math.max(0, (saleDoc.total || 0) - paid);
  const pStatus = saleDoc.status === 'CANCELLED' ? 'CANCELLED'
    : outstanding <= 0 ? 'PAID'
    : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  const obj = saleDoc.toObject ? saleDoc.toObject() : saleDoc;
  return { ...obj, amountPaid: paid, outstanding, paymentStatus: pStatus };
};

exports.getOne = asyncHandler(async (req, res) => {
  const saleDoc = await Sale.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('cashier', 'name');
  if (!saleDoc) return error(res, 'Sale not found', 404);
  const sale = await enrichSale(saleDoc);
  const loan = await Loan.findOne({ sale: saleDoc._id });
  success(res, 'Sale', { sale, loan: loan || null });
});

exports.cancel = asyncHandler(async (req, res) => {
  await cancelSale(req.params.id, req.user);
  success(res, 'Sale cancelled — stock restored');
});

exports.invoice = asyncHandler(async (req, res) => {
  const saleDoc = await Sale.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('cashier', 'name');
  if (!saleDoc) return error(res, 'Sale not found', 404);
  const sale = await enrichSale(saleDoc);
  const loan = await Loan.findOne({ sale: saleDoc._id });
  const settings = require('../models/Setting');
  const s = {};
  for (const row of await settings.find()) s[row.key] = row.value;
  success(res, 'Invoice', { sale, loan, settings: s });
});