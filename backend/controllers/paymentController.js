const { Payment, Loan, LoanPayment, Sale } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { nextNumber } = require('../utils/helpers');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, from, to, method, customer } = req.query;
  const filter = {};
  if (from || to) filter.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59') }) };
  if (method) filter.method = method;
  if (customer) filter.customer = customer;
  const total = await Payment.countDocuments(filter);
  const payments = await Payment.find(filter)
    .populate('customer', 'name phone')
    .populate('receivedBy', 'name')
    .sort('-date')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const income = await Payment.aggregate([{ $match: { ...filter, status: 'PAID' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const receivable = await Payment.aggregate([{ $match: { status: 'UNPAID' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  success(res, 'Payments', { payments, total, income: income[0]?.total || 0, receivable: receivable[0]?.total || 0 });
});

exports.repayLoan = asyncHandler(async (req, res) => {
  const { loanId } = req.params;
  const { amount, method = 'CASH', reference, date, note } = req.body;
  const money = Number(amount);
  if (!money || money <= 0) return error(res, 'Enter a valid repayment amount');
  const loan = await Loan.findById(loanId);
  if (!loan) return error(res, 'Loan not found', 404);
  if (loan.status === 'CANCELLED') return error(res, 'Loan is cancelled');
  if (loan.status === 'PAID') return error(res, 'Loan is already fully paid');
  if (money > loan.outstanding) return error(res, `Repayment cannot exceed outstanding balance (${loan.outstanding} RWF)`);

  const prevOutstanding = loan.outstanding;
  const newOutstanding = prevOutstanding - money;
  loan.amountPaid += money;
  loan.outstanding = newOutstanding;
  loan.status = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  await loan.save();

  if (loan.sale) {
    const sale = await Sale.findById(loan.sale);
    if (sale) {
      const saleNewOutstanding = Math.max(0, (sale.outstanding || 0) - money);
      sale.amountPaid = Math.min((sale.amountPaid || 0) + money, sale.total || 0);
      sale.outstanding = saleNewOutstanding;
      sale.paymentStatus = saleNewOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      await sale.save();
    }
  }

  await LoanPayment.create({
    loan: loan._id,
    loanNumber: loan.loanNumber,
    customer: loan.customer,
    amount: money,
    previousOutstanding: prevOutstanding,
    newOutstanding,
    method,
    reference,
    note,
    receivedBy: req.user._id,
    date: date || Date.now(),
  });

  const paymentNumber = await nextNumber('PAY');
  await Payment.create({
    paymentNumber,
    sale: loan.sale,
    loan: loan._id,
    customer: loan.customer,
    method,
    amount: money,
    reference,
    status: 'PAID',
    receivedBy: req.user._id,
    date: date || Date.now(),
  });

  const { notify } = require('../services/notificationService');
  await notify('LOAN_REPAYMENT', `Repayment of ${money} RWF received on loan ${loan.loanNumber}`, `Ishyurwa rya ${money} RWF ku nguzanyo ${loan.loanNumber}`, { loan: loan._id, sale: loan.sale });

  await audit(req, 'LOAN_REPAYMENT', 'Loan', loan._id, { loanNumber: loan.loanNumber, amount: money, method, newOutstanding });
  success(res, 'Repayment recorded');
});