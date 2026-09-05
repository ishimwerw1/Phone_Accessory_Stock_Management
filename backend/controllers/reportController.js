const { Product, Sale, Payment, Loan, LoanPayment, Customer, Supplier, StockTransaction, Category, Brand, PhoneModel, Expense, Purchase, SupplierPayment, Order } = require('../models');
const { success, asyncHandler } = require('../utils/response');

const dateRange = (period, from, to) => {
  const now = new Date();
  const norm = period === 'this.week' ? 'week' : period === 'this.month' ? 'month' : period === 'this.year' ? 'year' : period;
  let start = null;
  if (norm === 'today') { start = new Date(now.setHours(0, 0, 0, 0)); }
  else if (norm === 'week') { start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0); }
  else if (norm === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (norm === 'year') { start = new Date(now.getFullYear(), 0, 1); }
  if (from) start = new Date(from);
  const end = to ? new Date(to + 'T23:59:59') : null;
  return { start, end };
};

exports.dashboard = asyncHandler(async (req, res) => {
  const { period = 'today' } = req.query;
  const { start: periodStart } = dateRange(period, null, null);
  const periodFrom = periodStart || new Date();
  const pStart = periodStart || new Date(new Date().setHours(0, 0, 0, 0));
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    productStatsR, periodSalesR, salesTotalR,
    periodPaymentsR, allTimePaymentsR, monthPaymentsR,
    lowR, outR, topR, byMethodR, recent7R, loanTotalsR, recentTxnsR,
    custR, suppR, todayExpensesR, monthExpensesR, todayPurchasesR, supplierDebtsR,
    todayOrdersR, activeUsersR, purchasePaymentsR, monthSalesCostR,
  ] = await Promise.all([
    Product.aggregate([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: null, count: { $sum: 1 }, items: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } } } },
    ]),
    Sale.aggregate([
      { $match: { status: { $ne: 'CANCELLED' }, createdAt: { $gte: pStart } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' }, sold: { $sum: { $size: '$items' } } } },
    ]),
    Sale.aggregate([
      { $match: { status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$total' }, cost: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: ['$$this.quantity', { $ifNull: ['$$this.cost', 0] }] }] } } } } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'PAID', date: { $gte: pStart } } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'PAID' } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'PAID', date: { $gte: monthStart } } },
      { $group: { _id: null, paid: { $sum: '$amount' } } },
    ]),
    Product.find({ status: 'ACTIVE', quantity: { $gt: 0 }, $expr: { $lte: ['$quantity', '$minStock'] } }).select('name sku quantity minStock sellingPrice brand category'),
    Product.find({ status: 'ACTIVE', quantity: { $lte: 0 } }).select('name sku quantity minStock sellingPrice'),
    Sale.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $unwind: '$items' },
      { $sortByCount: '$items.name' },
      { $limit: 8 },
    ]),
    Sale.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Sale.aggregate([
      { $match: { status: 'COMPLETED', createdAt: { $gte: periodFrom } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Loan.aggregate([{ $match: { status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, sum: { $sum: '$outstanding' }, count: { $sum: 1 } } }]),
    StockTransaction.find().populate('performedBy', 'name').sort('-date').limit(10),
    Customer.countDocuments({ status: 'ACTIVE' }),
    Supplier.countDocuments({ status: 'ACTIVE' }),
    Expense.aggregate([{ $match: { date: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Purchase.aggregate([{ $match: { createdAt: { $gte: todayStart }, status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
    Purchase.aggregate([{ $match: { paymentStatus: { $ne: 'PAID' } } }, { $group: { _id: null, total: { $sum: '$remainingAmount' }, count: { $sum: 1 } } }]),
    Order.countDocuments({ createdAt: { $gte: todayStart } }),
    require('../models').User.countDocuments({ isActive: true }),
    Purchase.aggregate([
      { $match: { createdAt: { $gte: monthStart }, status: { $ne: 'CANCELLED' } } },
      { $project: { outflow: '$amountPaid' } },
      { $group: { _id: null, total: { $sum: '$outflow' } } },
    ]).then(async (purchaseOut) => {
      const supplierOut = await SupplierPayment.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
      return [{ _id: null, total: (purchaseOut[0]?.total || 0) + (supplierOut[0]?.total || 0) }];
    }),
    Sale.aggregate([
      { $match: { status: { $ne: 'CANCELLED' }, createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$total' }, cost: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: ['$$this.quantity', { $ifNull: ['$$this.cost', 0] }] }] } } } } } },
    ]),
  ]);

  const [productStats] = productStatsR;
  const [periodSales] = periodSalesR;
  const [salesTotal] = salesTotalR;
  const periodPaid = periodPaymentsR[0]?.paid || 0;
  const allTimePaid = allTimePaymentsR[0]?.paid || 0;
  const monthPaid = monthPaymentsR[0]?.paid || 0;

  const low = lowR;
  const out = outR;
  const topProducts = topR;
  const byMethod = byMethodR;
  const recent7 = recent7R;
  const [loanTotals] = loanTotalsR;
  const recentTxns = recentTxnsR;

  const totalSalesRevenue = salesTotal?.total || 0;
  const totalCostOfGoods = salesTotal?.cost || 0;
  const grossProfitAllTime = totalSalesRevenue - totalCostOfGoods;
  const totalExpenses = monthExpensesR[0]?.total || 0;
  const totalPurchasePayments = purchasePaymentsR[0]?.total || 0;
  const [monthSales] = monthSalesCostR || [];
  const monthRevenue = monthSales?.total || 0;
  const monthCost = monthSales?.cost || 0;
  const monthGrossProfit = monthRevenue - monthCost;
  const monthlyExpenses = totalExpenses;
  const monthNetProfit = monthGrossProfit - monthlyExpenses;

  success(res, 'Dashboard', {
    totalProducts: productStats?.count || 0,
    totalStockItems: productStats?.items || 0,
    stockValue: productStats?.value || 0,
    todaySales: periodSales?.count || 0,
    todayRevenue: periodPaid,
    totalCustomers: custR,
    totalSuppliers: suppR,
    totalSalesValue: totalSalesRevenue,
    totalPaid: allTimePaid,
    totalRevenueCost: totalCostOfGoods,
    grossProfit: monthGrossProfit,
    grossProfitAllTime: grossProfitAllTime,
    netProfit: monthNetProfit,
    netProfitMonth: monthNetProfit,
    monthRevenue,
    monthCost,
    monthPaid,
    monthlyExpenses,
    todayExpenses: todayExpensesR[0]?.total || 0,
    todayPurchases: todayPurchasesR[0]?.total || 0,
    todayPurchaseCount: todayPurchasesR[0]?.count || 0,
    outstandingSupplierDebts: supplierDebtsR[0]?.total || 0,
    supplierDebtCount: supplierDebtsR[0]?.count || 0,
    todayOrders: todayOrdersR || 0,
    activeUsers: activeUsersR || 0,
    lowStock: low,
    outOfStock: out,
    topProducts: topProducts || [],
    byMethod: byMethod || [],
    salesTrend: recent7 || [],
    outstandingLoans: loanTotals?.sum || 0,
    recentTxns,
    lowStockCount: low.length,
    outOfStockCount: out.length,
  });
});

exports.salesReport = asyncHandler(async (req, res) => {
  const { period = 'month', from, to, groupBy = 'day' } = req.query;
  const { start, end } = dateRange(period, from, to);
  const match = { status: { $ne: 'CANCELLED' }, ...(start && { createdAt: { $gte: start } }), ...(end && { createdAt: { $lte: end } }) };
  const payMatch = { status: 'PAID', ...(start && { date: { $gte: start } }), ...(end && { date: { $lte: end } }) };

  const dateFmt = { day: '%Y-%m-%d', week: '%Y-%U', month: '%Y-%m', year: '%Y' };

  const [
    byDateRaw, byMethodRaw, byProduct, byCashierRaw, byCustomerRaw, totalsRaw, byDatePay, byMethodPay, totalsPay, discountR,
  ] = await Promise.all([
    Sale.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: dateFmt[groupBy] || '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' }, cost: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: ['$$this.quantity', { $ifNull: ['$$this.cost', 0] }] }] } } } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Sale.aggregate([{ $match: match }, { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Sale.aggregate([
      { $match: match }, { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' }, model: { $first: '$items.modelName' }, brand: { $first: '$items.brandName' } } },
      { $sort: { qty: -1 } },
    ]),
    Sale.aggregate([
      { $match: match }, { $group: { _id: '$cashier', total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 1, total: 1, count: 1, name: { $arrayElemAt: ['$u.name', 0] } } },
    ]),
    Sale.aggregate([
      { $match: match }, { $group: { _id: '$customer', total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'c' } },
      { $project: { _id: 1, total: 1, count: 1, name: { $arrayElemAt: ['$c.name', 0] }, phone: { $arrayElemAt: ['$c.phone', 0] } } },
      { $sort: { total: -1 } }, { $limit: 20 },
    ]),
    Sale.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$total' }, cost: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: ['$$this.quantity', { $ifNull: ['$$this.cost', 0] }] }] } } } }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: payMatch },
      { $group: { _id: { $dateToString: { format: dateFmt[groupBy] || '%Y-%m-%d', date: '$date' } }, paid: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([{ $match: payMatch }, { $group: { _id: '$method', paid: { $sum: '$amount' } } }]),
    Payment.aggregate([{ $match: payMatch }, { $group: { _id: null, paid: { $sum: '$amount' } } }]),
    Sale.aggregate([{ $match: match }, { $group: { _id: null, d: { $sum: '$discount' } } }]),
  ]);

  const payMap = {}; byDatePay.forEach((r) => { payMap[r._id] = r.paid; });
  const byDate = byDateRaw.map((r) => ({ ...r, paid: payMap[r._id] || 0 }));

  const payMethodMap = {}; byMethodPay.forEach((r) => { payMethodMap[r._id] = r.paid; });
  const byMethod = byMethodRaw.map((r) => ({ ...r, paid: payMethodMap[r._id] || 0 }));

  const paidByCustomer = {};
  const cids = byCustomerRaw.map((r) => r._id).filter(Boolean);
  if (cids.length > 0) {
    const custPay = await Payment.aggregate([
      { $match: { customer: { $in: cids }, ...payMatch } },
      { $group: { _id: '$customer', paid: { $sum: '$amount' } } },
    ]);
    custPay.forEach((r) => { paidByCustomer[String(r._id)] = r.paid; });
  }
  const byCustomer = byCustomerRaw.map((r) => ({ ...r, paid: paidByCustomer[String(r._id)] || 0 }));

  const t = totalsRaw[0] || { total: 0, cost: 0, count: 0 };
  const paid = totalsPay[0]?.paid || 0;
  success(res, 'Sales report', {
    byDate, byMethod, byProduct, byCashier, byCustomer,
    discount: discountR[0]?.d || 0,
    totals: { ...t, paid, profit: t.total - t.cost, outstanding: Math.max(0, t.total - paid) },
  });
});

exports.stockReport = asyncHandler(async (req, res) => {
  const products = await Product.find({ status: 'ACTIVE' })
    .populate('category', 'name').populate('brand', 'name').populate('supplier', 'name').sort('name').lean();
  const low = products.filter((p) => p.quantity > 0 && p.quantity <= p.minStock);
  const out = products.filter((p) => p.quantity <= 0);
  const byCategory = await Product.aggregate([
    { $match: { status: 'ACTIVE' } },
    { $group: { _id: '$category', count: { $sum: 1 }, items: { $sum: '$quantity' }, value: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'c' } },
    { $project: { _id: 1, count: 1, items: 1, value: 1, name: { $arrayElemAt: ['$c.name', 0] } } },
  ]);
  const damaged = await StockTransaction.find({ type: 'DAMAGED' }).populate('performedBy', 'name').sort('-date').limit(100);
  const returned = await StockTransaction.find({ type: 'RETURN' }).populate('performedBy', 'name').sort('-date').limit(100);
  const adjustments = await StockTransaction.find({ type: 'ADJUSTMENT' }).populate('performedBy', 'name').sort('-date').limit(100);
  success(res, 'Stock report', { products, low, out, byCategory, damaged, returned, adjustments, lowCount: low.length, outCount: out.length });
});

exports.productReport = asyncHandler(async (req, res) => {
  const bestSelling = await Sale.aggregate([
    { $match: { status: 'COMPLETED' } }, { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $first: '$items.name' }, qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' }, cost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$items.cost', 0] }] } } } },
    { $sort: { qty: -1 } }, { $limit: 50 },
  ]);
  const branded = await Product.find({ status: 'ACTIVE' }).populate('brand', 'name').select('name brand');
  const byBrand = {};
  const byModel = {};
  const byCondition = {};
  const partTypes = await PhoneModel.countDocuments();
  const byCategoryCount = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  for (const p of branded) {
    if (p.brand?.name) byBrand[p.brand.name] = (byBrand[p.brand.name] || 0) + 1;
    const m = p.compatibleModels || [];
    for (const mm of m) byModel[mm.name] = (byModel[mm.name] || 0) + 1;
    byCondition[p.condition] = (byCondition[p.condition] || 0) + 1;
  }
  success(res, 'Product report', {
    bestSelling,
    byBrand: Object.entries(byBrand).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    byModel: Object.entries(byModel).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    byCondition: Object.entries(byCondition).map(([name, count]) => ({ name, count })),
    byCategory: byCategoryCount,
  });
});

exports.customerReport = asyncHandler(async (req, res) => {
  const customers = await Customer.find({ status: 'ACTIVE' }).sort('-createdAt').lean();
  const ids = customers.map((c) => c._id);
  const salesAgg = await Sale.aggregate([
    { $match: { status: { $ne: 'CANCELLED' }, customer: { $in: ids } } },
    { $group: { _id: '$customer', total: { $sum: '$total' }, count: { $sum: 1 } } },
  ]);
  const paymentsAgg = await Payment.aggregate([
    { $match: { customer: { $in: ids }, status: 'PAID' } },
    { $group: { _id: '$customer', paid: { $sum: '$amount' } } },
  ]);
  const loanAgg = await Loan.aggregate([
    { $match: { status: { $ne: 'CANCELLED' }, customer: { $in: ids } } },
    { $group: { _id: '$customer', debt: { $sum: '$outstanding' } } },
  ]);
  const saleMap = {};
  salesAgg.forEach((r) => { saleMap[String(r._id)] = r; });
  const payMap = {};
  paymentsAgg.forEach((r) => { payMap[String(r._id)] = r; });
  const loanMap = {};
  loanAgg.forEach((r) => { loanMap[String(r._id)] = r; });
  const rows = customers.map((c) => ({
    _id: c._id, name: c.name, phone: c.phone,
    total: saleMap[String(c._id)]?.total || 0,
    paid: payMap[String(c._id)]?.paid || 0,
    count: saleMap[String(c._id)]?.count || 0,
    debt: loanMap[String(c._id)]?.debt || 0,
  }));
  rows.sort((a, b) => (b.total || 0) - (a.total || 0));
  success(res, 'Customer report', { top: rows.slice(0, 20), debtors: rows.filter((r) => r.debt > 0).sort((a, b) => b.debt - a.debt) });
});

exports.loanReport = asyncHandler(async (req, res) => {
  const [totals] = await Loan.aggregate([{ $match: { status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' }, outstanding: { $sum: '$outstanding' }, count: { $sum: 1 } } }]);
  const [overdue] = await Loan.aggregate([{ $match: { status: { $in: ['ACTIVE', 'PARTIALLY_PAID'] }, dueDate: { $lt: new Date() } } }, { $group: { _id: null, sum: { $sum: '$outstanding' }, count: { $sum: 1 } } }]);
  const [repayments] = await LoanPayment.aggregate([{ $group: { _id: null, sum: { $sum: '$amount' }, count: { $sum: 1 } } }]);
  const byStatus = await Loan.aggregate([{ $group: { _id: '$status', sum: { $sum: '$outstanding' }, count: { $sum: 1 } } }]);
  success(res, 'Loan report', {
    totals: totals || { total: 0, paid: 0, outstanding: 0, count: 0 },
    overdue: overdue || { sum: 0, count: 0 },
    repayments: repayments || { sum: 0, count: 0 },
    byStatus,
  });
});

exports.financialReport = asyncHandler(async (req, res) => {
  const { period = 'month', from, to } = req.query;
  const { start, end } = dateRange(period, from, to);
  const match = { status: { $ne: 'CANCELLED' }, ...(start && { createdAt: { $gte: start } }), ...(end && { createdAt: { $lte: end } }) };
  const payMatch = { status: 'PAID', ...(start && { date: { $gte: start } }), ...(end && { date: { $lte: end } }) };
  const expenseMatch = { ...(start && { date: { $gte: start } }), ...(end && { date: { $lte: end } }) };

  const [agg, payAgg, stockInCost, totalExpenses, expensesByCategory, purchasesAgg] = await Promise.all([
    Sale.aggregate([
      { $match: match },
      { $group: { _id: null, sales: { $sum: '$total' }, discount: { $sum: '$discount' }, cost: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', { $multiply: ['$$this.quantity', { $ifNull: ['$$this.cost', 0] }] }] } } } }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([{ $match: payMatch }, { $group: { _id: null, paid: { $sum: '$amount' } } }]),
    StockTransaction.aggregate([{ $match: { type: 'STOCK_IN' } }, { $group: { _id: null, qty: { $sum: '$quantity' } } }]),
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Purchase.aggregate([
      { $match: { status: { $ne: 'CANCELLED' }, ...(start && { createdAt: { $gte: start } }), ...(end && { createdAt: { $lte: end } }) } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' }, remaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const t = agg[0] || { sales: 0, discount: 0, cost: 0, count: 0 };
  const paid = payAgg[0]?.paid || 0;
  const grossProfit = t.sales - t.cost;
  const expenses = totalExpenses[0]?.total || 0;
  const netProfit = grossProfit - expenses;
  const purchases = purchasesAgg[0] || { total: 0, paid: 0, remaining: 0, count: 0 };

  success(res, 'Financial report', {
    totals: {
      sales: t.sales, paid, credit: t.sales - paid, outstanding: Math.max(0, t.sales - paid),
      discounts: t.discount, cost: t.cost, count: t.count,
      grossProfit,
      totalExpenses: expenses,
      netProfit,
      totalPurchases: purchases.total,
      paidPurchases: purchases.paid,
      outstandingPurchases: purchases.remaining,
      purchaseCount: purchases.count,
    },
    expensesByCategory,
    stockInQty: stockInCost[0]?.qty || 0,
  });
});

exports.expenseReport = asyncHandler(async (req, res) => {
  const { period = 'month', from, to } = req.query;
  const { start, end } = dateRange(period, from, to);
  const expenseMatch = { ...(start && { date: { $gte: start } }), ...(end && { date: { $lte: end } }) };

  const [totals, byCategory, byUser, byDate] = await Promise.all([
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$createdBy', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 1, total: 1, count: 1, name: { $arrayElemAt: ['$u.name', 0] } } },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  success(res, 'Expense report', {
    totals: totals[0] || { total: 0, count: 0 },
    byCategory,
    byUser,
    byDate,
  });
});

exports.purchaseReport = asyncHandler(async (req, res) => {
  const { period = 'month', from, to } = req.query;
  const { start, end } = dateRange(period, from, to);
  const match = { status: { $ne: 'CANCELLED' }, ...(start && { createdAt: { $gte: start } }), ...(end && { createdAt: { $lte: end } }) };

  const [totals, bySupplier, paymentsAgg, overdueAgg, byType] = await Promise.all([
    Purchase.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' }, remaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      { $match: match },
      { $group: { _id: '$supplier', total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' }, remaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 's' } },
      { $project: { _id: 1, total: 1, paid: 1, remaining: 1, count: 1, name: { $arrayElemAt: ['$s.name', 0] } } },
      { $sort: { total: -1 } },
    ]),
    require('../models').SupplierPayment.aggregate([
      { $match: { ...(start && { date: { $gte: start } }), ...(end && { date: { $lte: end } }) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      { $match: { paymentStatus: { $ne: 'PAID' }, dueDate: { $lt: new Date() } } },
      { $group: { _id: null, total: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      { $match: match },
      { $group: { _id: '$type', total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' }, remaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  success(res, 'Purchase report', {
    totals: totals[0] || { total: 0, paid: 0, remaining: 0, count: 0 },
    bySupplier,
    payments: paymentsAgg[0] || { total: 0, count: 0 },
    overdue: overdueAgg[0] || { total: 0, count: 0 },
    byType: byType || [],
    normal: (byType.find((t) => t._id === 'NORMAL') || { total: 0, count: 0 }),
    onDemand: (byType.find((t) => t._id === 'ON_DEMAND') || { total: 0, count: 0 }),
  });
});

exports.userPerformanceReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const saleMatch = { status: 'COMPLETED', ...(from && { createdAt: { $gte: new Date(from) } }), ...(to && { createdAt: { $lte: new Date(to + 'T23:59:59') } }) };
  const expenseMatch = { ...(from && { date: { $gte: new Date(from) } }), ...(to && { date: { $lte: new Date(to + 'T23:59:59') } }) };

  const users = await require('../models').User.find({ isActive: true }).select('name role').lean();

  const [salesByUser, expensesByUser, ordersByUser] = await Promise.all([
    Sale.aggregate([
      { $match: saleMatch },
      { $group: { _id: '$cashier', total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: '$createdBy', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    require('../models').Order.aggregate([
      { $match: { createdBy: { $exists: true }, ...(from && { createdAt: { $gte: new Date(from) } }), ...(to && { createdAt: { $lte: new Date(to + 'T23:59:59') } }) } },
      { $group: { _id: '$createdBy', total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
  ]);

  const salesMap = {};
  salesByUser.forEach((r) => { salesMap[String(r._id)] = r; });
  const expenseMap = {};
  expensesByUser.forEach((r) => { expenseMap[String(r._id)] = r; });
  const ordersMap = {};
  ordersByUser.forEach((r) => { ordersMap[String(r._id)] = r; });

  const performance = users.map((u) => ({
    _id: u._id,
    name: u.name,
    role: u.role,
    salesCount: salesMap[String(u._id)]?.count || 0,
    salesTotal: salesMap[String(u._id)]?.total || 0,
    expensesCount: expenseMap[String(u._id)]?.count || 0,
    expensesTotal: expenseMap[String(u._id)]?.total || 0,
    ordersCount: ordersMap[String(u._id)]?.count || 0,
    ordersTotal: ordersMap[String(u._id)]?.total || 0,
    transactionValue: (salesMap[String(u._id)]?.total || 0) + (ordersMap[String(u._id)]?.total || 0),
  }));

  success(res, 'User performance report', performance);
});
