const { Loan, LoanPayment, Customer, Sale } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const { search, status, from, to, page = 1, limit = 20 } = req.query;
  const filter = { status: { $ne: 'CANCELLED' } };
  if (status) {
    if (status === 'ACTIVE_OVERDUE') filter.status = { $in: ['ACTIVE', 'PARTIALLY_PAID'] };
    else filter.status = status;
  }
  if (from || to) filter.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59') }) };
  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ loanNumber: re }, { customerName: re }, { customerPhone: re }];
  }
  const total = await Loan.countDocuments(filter);
  const loans = await Loan.find(filter)
    .populate('customer', 'name phone')
    .sort('-date')
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const now = new Date();
  for (const l of loans) {
    if (['ACTIVE', 'PARTIALLY_PAID'].includes(l.status) && l.dueDate && new Date(l.dueDate) < now) {
      l.status = 'OVERDUE';
    }
  }

  const stats = await loanStats();
  success(res, 'Loans', { loans, total, stats });
});

const loanStats = async () => {
  const now = new Date();
  const [totals] = await Loan.aggregate([
    { $match: { status: { $ne: 'CANCELLED' } } },
    { $group: { _id: null, outstanding: { $sum: '$outstanding' }, total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
  ]);
  const [overdue] = await Loan.aggregate([
    { $match: { status: { $in: ['ACTIVE', 'PARTIALLY_PAID'] }, dueDate: { $lt: now } } },
    { $group: { _id: null, sum: { $sum: '$outstanding' }, count: { $sum: 1 } } },
  ]);
  return {
    totalOutstanding: totals?.outstanding || 0,
    totalLoans: totals?.count || 0,
    totalCredit: totals?.total || 0,
    totalRepaid: totals?.paid || 0,
    active: await Loan.countDocuments({ status: { $in: ['ACTIVE', 'PARTIALLY_PAID'] } }),
    paid: await Loan.countDocuments({ status: 'PAID' }),
    partial: await Loan.countDocuments({ status: 'PARTIALLY_PAID' }),
    overdue: overdue?.count || 0,
    overdueAmount: overdue?.sum || 0,
  };
};

exports.stats = asyncHandler(async (req, res) => {
  success(res, 'Loan dashboard', await loanStats());
});

exports.getOne = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id)
    .populate('customer', 'name phone email address')
    .populate('createdBy', 'name');
  if (!loan) return error(res, 'Loan not found', 404);
  if (['ACTIVE', 'PARTIALLY_PAID'].includes(loan.status) && loan.dueDate && new Date(loan.dueDate) < new Date()) loan.status = 'OVERDUE';
  const repayments = await LoanPayment.find({ loan: loan._id }).populate('receivedBy', 'name').sort('-date');
  const sale = await Sale.findById(loan.sale).populate('cashier', 'name');
  success(res, 'Loan', { loan, repayments, sale });
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowed = ['dueDate', 'note'];
  const patch = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) patch[k] = req.body[k]; });
  const loan = await Loan.findByIdAndUpdate(id, patch, { new: true });
  if (!loan) return error(res, 'Loan not found', 404);
  await audit(req, 'LOAN_UPDATED', 'Loan', id, patch);
  success(res, 'Loan updated', loan);
});

exports.cancel = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) return error(res, 'Loan not found', 404);
  if (loan.amountPaid > 0) return error(res, 'Cannot cancel a loan that has recorded payments. You must repay or adjust it.');
  loan.status = 'CANCELLED';
  await loan.save();
  await audit(req, 'LOAN_CANCELLED', 'Loan', loan._id, { loanNumber: loan.loanNumber });
  success(res, 'Loan cancelled');
});