const mongoose = require('mongoose');
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

const accountKey = (l) => (l.customer ? String(l.customer) : `__name__|${l.customerName || ''}|${l.customerPhone || ''}`);

const effectiveLoanStatus = (l) => {
  if (['ACTIVE', 'PARTIALLY_PAID'].includes(l.status) && l.dueDate && new Date(l.dueDate) < new Date()) return 'OVERDUE';
  return l.status;
};

const accountStatus = (a) => {
  if (a.remainingBalance <= 0) return 'PAID';
  if (a.statuses.has('OVERDUE')) return 'OVERDUE';
  if (a.statuses.has('ACTIVE')) return 'ACTIVE';
  return 'PARTIALLY_PAID';
};

exports.getAccounts = asyncHandler(async (req, res) => {
  const { search, status, from, to, page = 1, limit = 15 } = req.query;
  const match = { status: { $ne: 'CANCELLED' } };
  if (from || to) match.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59') }) };

  const loans = await Loan.find(match)
    .select('customer customerName customerPhone totalAmount amountPaid outstanding status dueDate date')
    .lean();

  const map = new Map();
  for (const l of loans) {
    const key = accountKey(l);
    if (!map.has(key)) {
      map.set(key, {
        customer: l.customer,
        customerName: l.customerName,
        customerPhone: l.customerPhone,
        transactionCount: 0,
        totalDebt: 0,
        totalPaid: 0,
        remainingBalance: 0,
        statuses: new Set(),
      });
    }
    const a = map.get(key);
    a.transactionCount += 1;
    a.totalDebt += l.totalAmount;
    a.totalPaid += l.amountPaid;
    a.remainingBalance += l.outstanding;
    a.statuses.add(effectiveLoanStatus(l));
  }

  let accounts = [...map.values()].map((a) => ({
    customer: a.customer,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    transactionCount: a.transactionCount,
    totalDebt: a.totalDebt,
    totalPaid: a.totalPaid,
    remainingBalance: a.remainingBalance,
    status: accountStatus(a),
  }));

  if (search) {
    const re = new RegExp(search, 'i');
    accounts = accounts.filter((a) => (a.customerName && re.test(a.customerName)) || (a.customerPhone && re.test(a.customerPhone)));
  }
  if (status && status !== 'ALL') {
    accounts = accounts.filter((a) => a.status === status);
  }

  const total = accounts.length;
  accounts.sort((a, b) => b.remainingBalance - a.remainingBalance);
  const start = (Number(page) - 1) * Number(limit);
  accounts = accounts.slice(start, start + Number(limit));

  success(res, 'Loan accounts', { accounts, total, page: Number(page), limit: Number(limit) });
});

exports.getAccountDetail = asyncHandler(async (req, res) => {
  const { customerId } = req.params;
  let customer = null;

  const build = async (filter) => {
    const loans = await Loan.find({ ...filter, status: { $ne: 'CANCELLED' } })
      .populate('sale', 'saleNumber items total')
      .sort('-date');

    const transactions = loans.map((l) => ({
      _id: l._id,
      loanNumber: l.loanNumber,
      customerName: l.customerName,
      customerPhone: l.customerPhone,
      sale: l.sale,
      saleNumber: l.sale?.saleNumber,
      items: l.sale?.items || [],
      date: l.date || l.createdAt,
      totalAmount: l.totalAmount,
      amountPaid: l.amountPaid,
      outstanding: l.outstanding,
      dueDate: l.dueDate,
      status: effectiveLoanStatus(l),
    }));

    const accountName = customer?.name || transactions[0]?.customerName || 'Customer';
    const accountPhone = customer?.phone || transactions[0]?.customerPhone || '';
    const accountAddress = customer?.address || '';
    const accountEmail = customer?.email || '';

    const totals = transactions.reduce(
      (acc, t) => {
        acc.totalDebt += t.totalAmount;
        acc.totalPaid += t.amountPaid;
        acc.remainingBalance += t.outstanding;
        return acc;
      },
      { transactionCount: transactions.length, totalDebt: 0, totalPaid: 0, remainingBalance: 0 }
    );

    const repayments = mongoose.isValidObjectId(customerId)
      ? await LoanPayment.find({ customer: customerId }).populate('receivedBy', 'name').sort('-date')
      : [];

    return { customer, accountName, accountPhone, accountAddress, accountEmail, transactions, totals, repayments };
  };

  if (customerId) {
    if (customerId === 'void') {
      customer = null;
      const data = await build({ customer: null });
      if (data.transactions.length === 0) return error(res, 'No loan records found', 404);
      return success(res, 'Loan account', data);
    }
    customer = await Customer.findById(customerId).select('name phone email address');
    const data = await build({ customer: customerId });
    if (data.transactions.length === 0) return error(res, 'No loan records found', 404);
    return success(res, 'Loan account', data);
  }
  return error(res, 'Customer is required', 400);
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