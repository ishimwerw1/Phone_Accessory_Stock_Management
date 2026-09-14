const mongoose = require('mongoose');
const { Loan, LoanPayment, Customer, Sale, Product, StockTransaction, Payment } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { nextNumber } = require('../utils/helpers');
const { notify } = require('../services/notificationService');
const {
  computeItemStatus,
  effectiveLoanStatus,
  recomputeLoan,
  ensureLoanItems,
  allocateFIFO,
} = require('../services/loanItemService');

exports.getAll = asyncHandler(async (req, res) => {
  const { search, status, from, to, page = 1, limit = 20 } = req.query;
  const filter = { status: { $ne: 'CANCELLED' } };
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
    l.status = effectiveLoanStatus(l);
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
  await ensureLoanItems(loan);
  loan.status = effectiveLoanStatus(loan);
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

const serializeItem = (it, loan, saleNumber) => ({
  itemId: it._id,
  productId: it.product,
  name: it.name,
  sku: it.sku,
  quantity: it.quantity,
  price: it.price,
  total: it.total,
  amountPaid: it.amountPaid,
  outstanding: it.outstanding,
  status: computeItemStatus(it),
  returned: it.returned,
  returnedOn: it.returnedOn,
  returnReason: it.returnReason,
  date: it.date || loan.date || loan.createdAt,
  loan: { _id: loan._id, loanNumber: loan.loanNumber },
  loanId: loan._id,
  loanNumber: loan.loanNumber,
  saleNumber,
});

exports.getAccountDetail = asyncHandler(async (req, res) => {
  const { customerId } = req.params;
  let customer = null;

  const build = async (filter) => {
    const loans = await Loan.find({ ...filter, status: { $ne: 'CANCELLED' } })
      .populate('sale', 'saleNumber items total')
      .sort('-date');

    for (const l of loans) await ensureLoanItems(l);

    const transactions = loans.map((l) => {
      const items = (l.loanItems || []).map((it) => serializeItem(it, l, l.sale?.saleNumber));
      return {
        _id: l._id,
        loanNumber: l.loanNumber,
        customerName: l.customerName,
        customerPhone: l.customerPhone,
        sale: l.sale,
        saleNumber: l.sale?.saleNumber,
        items,
        date: l.date || l.createdAt,
        totalAmount: l.totalAmount,
        amountPaid: l.amountPaid,
        outstanding: l.outstanding,
        dueDate: l.dueDate,
        status: effectiveLoanStatus(l),
      };
    });

    const accountName = customer?.name || transactions[0]?.customerName || 'Customer';
    const accountPhone = customer?.phone || transactions[0]?.customerPhone || '';
    const accountAddress = customer?.address || '';
    const accountEmail = customer?.email || '';

    const totals = transactions.reduce(
      (acc, t) => {
        acc.transactionCount += 1;
        acc.totalDebt += t.totalAmount;
        acc.totalPaid += t.amountPaid;
        acc.remainingBalance += t.outstanding;
        return acc;
      },
      { transactionCount: transactions.length, totalDebt: 0, totalPaid: 0, remainingBalance: 0 }
    );

    const products = [];
    transactions.forEach((t) => products.push(...t.items));

    const paidProducts = products.filter((p) => p.status === 'PAID' && !p.returned);
    const unpaidProducts = products.filter((p) => (p.status === 'UNPAID' || p.status === 'PARTIALLY_PAID') && p.outstanding > 0);

    const loanIds = loans.map((l) => l._id);
    const payQuery = { $or: [{ loan: { $in: loanIds } }] };
    if (mongoose.isValidObjectId(customerId)) payQuery.$or.push({ customer: customerId });
    const repayments = await LoanPayment.find(payQuery).populate('receivedBy', 'name').sort('-date');

    return {
      customer,
      accountName,
      accountPhone,
      accountAddress,
      accountEmail,
      transactions,
      products,
      paidProducts,
      unpaidProducts,
      totals,
      remainingDebt: totals.remainingBalance,
      repayments: repayments.map((p) => p.toObject()),
    };
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

exports.updateLoanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const loan = await Loan.findById(id);
  if (!loan) return error(res, 'Loan not found', 404);
  if (loan.status === 'CANCELLED') return error(res, 'Loan is cancelled');

  await ensureLoanItems(loan);
  const item = loan.loanItems.id(itemId);
  if (!item) return error(res, 'Loan item not found', 404);
  if (item.returned) return error(res, 'Cannot edit a returned item');

  const newProductId = req.body.product ? String(req.body.product) : item.product ? String(item.product) : null;
  const newQty = req.body.quantity !== undefined && Number(req.body.quantity) >= 1 ? Math.floor(Number(req.body.quantity)) : item.quantity;
  const newPrice = req.body.price !== undefined && Number(req.body.price) >= 0 ? Number(req.body.price) : item.price;
  const newTotal = Math.round(newQty * newPrice);

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const changedProduct = newProductId !== String(item.product || '');
    if (changedProduct) {
      const oldProduct = item.product ? await Product.findById(item.product, null, { session }) : null;
      if (oldProduct) {
        const prev = oldProduct.quantity;
        oldProduct.quantity = prev + item.quantity;
        await oldProduct.save({ session });
        await StockTransaction.create([{
          product: oldProduct._id,
          productName: oldProduct.name,
          sku: oldProduct.sku,
          type: 'RETURN',
          quantity: item.quantity,
          prevQuantity: prev,
          newQuantity: oldProduct.quantity,
          reason: `Loan item ${loan.loanNumber} product replaced`,
          reference: loan.loanNumber,
          sale: loan.sale,
          performedBy: req.user._id,
        }], { session });
      }
      if (!newProductId) return error(res, 'Select a product');
      const newProduct = await Product.findById(newProductId, null, { session });
      if (!newProduct) return error(res, 'Product not found', 404);
      if (newQty > newProduct.quantity) {
        return error(res, `${newProduct.name} — only ${newProduct.quantity} available in stock`);
      }
      const prev = newProduct.quantity;
      newProduct.quantity = prev - newQty;
      await newProduct.save({ session });
      await StockTransaction.create([{
        product: newProduct._id,
        productName: newProduct.name,
        sku: newProduct.sku,
        type: 'SALE',
        quantity: newQty,
        prevQuantity: prev,
        newQuantity: newProduct.quantity,
        reason: `Loan item ${loan.loanNumber} product replaced`,
        reference: loan.loanNumber,
        sale: loan.sale,
        performedBy: req.user._id,
      }], { session });
      item.product = newProduct._id;
      item.name = newProduct.name;
      item.sku = newProduct.sku;
    } else if (newQty !== item.quantity) {
      const product = await Product.findById(item.product, null, { session });
      if (product) {
        const diff = newQty - item.quantity;
        const prev = product.quantity;
        if (diff > 0) {
          if (diff > product.quantity) return error(res, `${product.name} — only ${product.quantity} available in stock`);
          product.quantity = prev - diff;
          await product.save({ session });
          await StockTransaction.create([{
            product: product._id,
            productName: product.name,
            sku: product.sku,
            type: 'SALE',
            quantity: diff,
            prevQuantity: prev,
            newQuantity: product.quantity,
            reason: `Loan item ${loan.loanNumber} quantity updated`,
            reference: loan.loanNumber,
            sale: loan.sale,
            performedBy: req.user._id,
          }], { session });
        } else {
          product.quantity = prev + Math.abs(diff);
          await product.save({ session });
          await StockTransaction.create([{
            product: product._id,
            productName: product.name,
            sku: product.sku,
            type: 'RETURN',
            quantity: Math.abs(diff),
            prevQuantity: prev,
            newQuantity: product.quantity,
            reason: `Loan item ${loan.loanNumber} quantity reduced`,
            reference: loan.loanNumber,
            sale: loan.sale,
            performedBy: req.user._id,
          }], { session });
        }
      }
    }

    item.quantity = newQty;
    item.price = newPrice;
    item.total = newTotal;
    item.amountPaid = Math.min(item.amountPaid || 0, newTotal);
    item.outstanding = Math.max(0, newTotal - item.amountPaid);
    item.status = computeItemStatus(item);

    recomputeLoan(loan);
    await loan.save({ session });
    await session.commitTransaction();

    await audit(req, 'LOAN_ITEM_UPDATED', 'Loan', loan._id, {
      loanNumber: loan.loanNumber, itemId: String(item._id), name: item.name, quantity: newQty, price: newPrice, total: newTotal,
    });
    success(res, 'Loan item updated', { loan, item });
  } catch (e) {
    await session.abortTransaction().catch(() => {});
    throw e;
  } finally {
    session.endSession();
  }
});

exports.returnLoanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { reason } = req.body;
  const loan = await Loan.findById(id);
  if (!loan) return error(res, 'Loan not found', 404);
  if (loan.status === 'CANCELLED') return error(res, 'Loan is cancelled');

  await ensureLoanItems(loan);
  const item = loan.loanItems.id(itemId);
  if (!item) return error(res, 'Loan item not found', 404);
  if (item.returned) return error(res, 'This item is already returned');

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    if (item.product) {
      const product = await Product.findById(item.product, null, { session });
      if (product) {
        const prev = product.quantity;
        product.quantity = prev + item.quantity;
        await product.save({ session });
        await StockTransaction.create([{
          product: product._id,
          productName: product.name,
          sku: product.sku,
          type: 'RETURN',
          quantity: item.quantity,
          prevQuantity: prev,
          newQuantity: product.quantity,
          reason: reason || `Loan item returned (${loan.loanNumber})`,
          reference: loan.loanNumber,
          sale: loan.sale,
          performedBy: req.user._id,
        }], { session });
      }
    }
    item.returned = true;
    item.returnedOn = new Date();
    item.returnReason = reason || '';
    item.returnedBy = req.user._id;
    item.status = 'RETURNED';

    recomputeLoan(loan);
    await loan.save({ session });
    await session.commitTransaction();

    await audit(req, 'LOAN_ITEM_RETURNED', 'Loan', loan._id, {
      loanNumber: loan.loanNumber, itemId: String(item._id), name: item.name, quantity: item.quantity,
    });
    await notify('PRODUCT_RETURN', `Loan item "${item.name}" returned on ${loan.loanNumber}`, `Ibigize ${item.name} byagarutse ku nguzanyo ${loan.loanNumber}`, { loan: loan._id, product: item.product, sale: loan.sale });
    success(res, 'Loan item returned', { loan, item });
  } catch (e) {
    await session.abortTransaction().catch(() => {});
    throw e;
  } finally {
    session.endSession();
  }
});

exports.payLoanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { amount, method = 'CASH', reference, date, note } = req.body;
  const money = Number(amount);
  if (!money || money <= 0) return error(res, 'Enter a valid payment amount');

  const loan = await Loan.findById(id);
  if (!loan) return error(res, 'Loan not found', 404);
  if (loan.status === 'CANCELLED') return error(res, 'Loan is cancelled');

  await ensureLoanItems(loan);
  const item = loan.loanItems.id(itemId);
  if (!item) return error(res, 'Loan item not found', 404);
  if (item.returned) return error(res, 'This item is returned');
  if (money > item.outstanding) {
    return error(res, `Payment cannot exceed the item's remaining balance of ${item.outstanding} RWF`);
  }

  const prevItemOutstanding = item.outstanding;
  item.amountPaid += money;
  item.outstanding = Math.max(0, prevItemOutstanding - money);
  item.status = computeItemStatus(item);
  recomputeLoan(loan);
  await loan.save();

  await LoanPayment.create({
    loan: loan._id,
    loanNumber: loan.loanNumber,
    customer: loan.customer,
    loanItem: item._id,
    product: item.product,
    itemName: item.name,
    amount: money,
    previousOutstanding: prevItemOutstanding,
    newOutstanding: item.outstanding,
    remainingAfter: item.outstanding,
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

  await notify('LOAN_REPAYMENT', `Payment of ${money} RWF received for "${item.name}" on loan ${loan.loanNumber}`, `Ishyurwa rya ${money} RWF kuri "${item.name}" y'inguzanyo ${loan.loanNumber}`, { loan: loan._id, sale: loan.sale });

  await audit(req, 'LOAN_ITEM_PAYMENT', 'Loan', loan._id, {
    loanNumber: loan.loanNumber, itemId: String(item._id), itemName: item.name, amount: money, method, newItemOutstanding: item.outstanding,
  });
  success(res, 'Payment recorded', { loan, item });
});

exports.cancel = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) return error(res, 'Loan not found', 404);
  if (loan.amountPaid > 0) return error(res, 'Cannot cancel a loan that has recorded payments. You must repay or adjust it.');
  const returnedOn = new Date();
  for (const item of (loan.loanItems || [])) {
    item.returned = true;
    item.returnedOn = returnedOn;
    item.returnReason = 'Loan cancelled';
    item.status = 'RETURNED';
  }
  loan.status = 'CANCELLED';
  await loan.save();
  await audit(req, 'LOAN_CANCELLED', 'Loan', loan._id, { loanNumber: loan.loanNumber });
  success(res, 'Loan cancelled');
});