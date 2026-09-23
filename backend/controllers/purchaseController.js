const mongoose = require('mongoose');
const { Purchase, Product, StockTransaction, SupplierPayment, Supplier } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { nextNumber } = require('../utils/helpers');
const { normalizeDateOnly, todayUtc } = require('../utils/date');

const buildPurchaseItems = async (items) => {
  const purchaseItems = [];
  let totalAmount = 0;
  for (const item of items) {
    if (!item.product || !item.quantity || !item.costPrice) {
      throw Object.assign(new Error('Each item must have product, quantity, and costPrice'), { status: 400 });
    }
    if (Number(item.quantity) <= 0) throw Object.assign(new Error('Quantity must be greater than 0'), { status: 400 });
    if (Number(item.costPrice) < 0) throw Object.assign(new Error('Cost price cannot be negative'), { status: 400 });

    const product = await Product.findById(item.product);
    if (!product) throw Object.assign(new Error(`Product not found: ${item.product}`), { status: 404 });

    const subtotal = Number(item.quantity) * Number(item.costPrice);
    totalAmount += subtotal;

    purchaseItems.push({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: Number(item.quantity),
      costPrice: Number(item.costPrice),
      subtotal,
    });
  }
  return { purchaseItems, totalAmount };
};

exports.getAll = asyncHandler(async (req, res) => {
  const { search, supplier, paymentStatus, status, type, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ purchaseNumber: re }, { supplierName: re }, { notes: re }];
  }
  if (supplier) filter.supplier = supplier;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [purchases, total] = await Promise.all([
    Purchase.find(filter).populate('supplier', 'name phone').populate('createdBy', 'name').sort('-createdAt').skip(skip).limit(Number(limit)),
    Purchase.countDocuments(filter),
  ]);

  success(res, 'Purchases', { purchases, total, pages: Math.ceil(total / Number(limit)) || 1, page: Number(page) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate('supplier', 'name phone email address')
    .populate('items.product', 'name sku')
    .populate('sale', 'saleNumber total paymentMethod')
    .populate('createdBy', 'name');
  if (!purchase) return error(res, 'Purchase not found', 404);
  const payments = await SupplierPayment.find({ purchase: purchase._id }).populate('receivedBy', 'name').sort('-date');
  const sale = purchase.sale ? await require('../models').Sale.findById(purchase.sale).populate('customer', 'name phone') : null;
  success(res, 'Purchase', { purchase, payments, sale });
});

exports.create = asyncHandler(async (req, res) => {
  const { supplier: supplierId, items, paymentMethod, amountPaid, dueDate, notes, purchaseDate } = req.body;

  if (!supplierId || !items || !items.length) {
    return error(res, 'Supplier and at least one item are required');
  }

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) return error(res, 'Supplier not found', 404);

  const { purchaseItems, totalAmount } = await buildPurchaseItems(items);

  const paidAmount = Number(amountPaid) || 0;
  if (paidAmount > totalAmount) return error(res, 'Amount paid cannot exceed total amount');

  const purchaseNumber = await nextNumber('PUR');
  const paymentStatus = paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

  const purchase = await Purchase.create({
    purchaseNumber,
    supplier: supplier._id,
    supplierName: supplier.name,
    supplierPhone: supplier.phone,
    items: purchaseItems,
    totalAmount,
    paymentMethod: paymentMethod || (paymentStatus === 'PAID' ? 'CASH' : 'CREDIT'),
    paymentStatus,
    amountPaid: paidAmount,
    remainingAmount: totalAmount - paidAmount,
    dueDate: dueDate || undefined,
    notes,
    status: 'RECEIVED',
    createdBy: req.user._id,
    createdAt: normalizeDateOnly(purchaseDate) || todayUtc(),
  });

  // Update stock for each product
  for (const item of purchaseItems) {
    const product = await Product.findById(item.product);
    const prevQty = product.quantity;
    product.quantity += item.quantity;
    if (!product.supplier) product.supplier = supplier._id;
    await product.save();

    await StockTransaction.create({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      type: 'STOCK_IN',
      quantity: item.quantity,
      prevQuantity: prevQty,
      newQuantity: product.quantity,
      reason: `Purchase ${purchaseNumber}`,
      reference: purchaseNumber,
      performedBy: req.user._id,
    });
  }

  await purchase.populate('supplier', 'name phone');
  await purchase.populate('createdBy', 'name');
  await audit(req, 'PURCHASE_CREATED', 'Purchase', purchase._id, { purchaseNumber, supplier: supplier.name, totalAmount, paymentStatus });
  success(res, 'Purchase created', purchase, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Cannot update a cancelled purchase');
  if (purchase.type === 'ON_DEMAND' || purchase.sale) {
    return error(res, 'On-demand purchases cannot be edited');
  }

  const { items, paymentMethod, amountPaid, dueDate, notes, purchaseDate, status } = req.body;

  let newItems = null;
  let newTotal = purchase.totalAmount;
  if (items) {
    if (!Array.isArray(items) || !items.length) return error(res, 'At least one item is required');
    const built = await buildPurchaseItems(items);
    newItems = built.purchaseItems;
    newTotal = built.totalAmount;
  }

  const paidAmount = amountPaid !== undefined ? Number(amountPaid) || 0 : purchase.amountPaid;
  if (paidAmount > newTotal) return error(res, 'Amount paid cannot exceed total amount');

  // Reverse the old purchase stock effect and apply the new one. We compare the
  // per-product quantities BEFORE and AFTER so:
  //   - unchanged quantities -> no stock movement (no duplicates)
  //   - date-only edits     -> no stock movement
  //   - qty/product changes -> one net adjustment per product
  if (purchase.status === 'RECEIVED' && newItems) {
    const oldMap = {};
    for (const it of purchase.items) oldMap[String(it.product)] = (oldMap[String(it.product)] || 0) + it.quantity;
    const newMap = {};
    for (const it of newItems) newMap[String(it.product)] = (newMap[String(it.product)] || 0) + it.quantity;

    const allIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    for (const pid of allIds) {
      const delta = (newMap[pid] || 0) - (oldMap[pid] || 0);
      if (delta === 0) continue;

      const product = await Product.findById(pid);
      if (!product) continue;
      const prevQty = product.quantity;
      product.quantity = Math.max(0, product.quantity + delta);
      await product.save();

      await StockTransaction.create({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        type: delta > 0 ? 'STOCK_IN' : 'RETURN',
        quantity: Math.abs(delta),
        prevQuantity: prevQty,
        newQuantity: product.quantity,
        reason: `Purchase ${purchase.purchaseNumber} updated`,
        reference: purchase.purchaseNumber,
        performedBy: req.user._id,
      });
    }
  }

  if (newItems) purchase.items = newItems;
  purchase.totalAmount = newTotal;
  purchase.amountPaid = paidAmount;
  purchase.remainingAmount = newTotal - paidAmount;
  purchase.paymentStatus = purchase.remainingAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

  if (paymentMethod) purchase.paymentMethod = paymentMethod;
  if (dueDate) purchase.dueDate = dueDate;
  if (notes !== undefined) purchase.notes = notes;
  if (purchaseDate) {
    const selectedDate = normalizeDateOnly(purchaseDate);
    if (selectedDate) {
      purchase.createdAt = selectedDate;
      purchase.markModified('createdAt');
    }
  }
  if (status && status !== 'CANCELLED') purchase.status = status;
  purchase.updatedBy = req.user._id;

  await purchase.save();
  await purchase.populate('supplier', 'name phone');
  await purchase.populate('createdBy', 'name');
  await audit(req, 'PURCHASE_UPDATED', 'Purchase', purchase._id, { purchaseNumber: purchase.purchaseNumber, totalAmount: purchase.totalAmount, paymentStatus: purchase.paymentStatus });
  success(res, 'Purchase updated successfully', purchase);
});

exports.remove = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) return error(res, 'Purchase not found', 404);

  // Reverse stock if purchase was received
  if (purchase.status === 'RECEIVED') {
    for (const item of purchase.items) {
      const product = await Product.findById(item.product);
      if (product) {
        const prevQty = product.quantity;
        product.quantity = Math.max(0, product.quantity - item.quantity);
        await product.save();

        await StockTransaction.create({
          product: product._id,
          productName: product.name,
          sku: product.sku,
          type: 'RETURN',
          quantity: item.quantity,
          prevQuantity: prevQty,
          newQuantity: product.quantity,
          reason: `Purchase ${purchase.purchaseNumber} cancelled`,
          reference: purchase.purchaseNumber,
          performedBy: req.user._id,
        });
      }
    }
  }

  purchase.status = 'CANCELLED';
  await purchase.save();
  await audit(req, 'PURCHASE_DELETED', 'Purchase', purchase._id, { purchaseNumber: purchase.purchaseNumber });
  success(res, 'Purchase cancelled');
});

exports.supplierDebts = asyncHandler(async (req, res) => {
  const { supplier, status, page = 1, limit = 20 } = req.query;
  const filter = { paymentStatus: { $ne: 'PAID' } };
  if (supplier) filter.supplier = supplier;
  if (status) filter.paymentStatus = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [purchases, total] = await Promise.all([
    Purchase.find(filter).populate('supplier', 'name phone').populate('createdBy', 'name').sort('-createdAt').skip(skip).limit(Number(limit)),
    Purchase.countDocuments(filter),
  ]);

  // Summary stats
  const [allDebts] = await Promise.all([
    Purchase.aggregate([
      { $match: { paymentStatus: { $ne: 'PAID' } } },
      { $group: { _id: null, totalDebt: { $sum: '$totalAmount' }, totalPaid: { $sum: '$amountPaid' }, totalRemaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const now = new Date();
  const overduePurchases = await Purchase.countDocuments({ paymentStatus: { $ne: 'PAID' }, dueDate: { $lt: now } });
  const dueSoonPurchases = await Purchase.countDocuments({ paymentStatus: { $ne: 'PAID' }, dueDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } });

  success(res, 'Supplier debts', {
    purchases,
    total,
    pages: Math.ceil(total / Number(limit)) || 1,
    summary: {
      totalDebt: allDebts[0]?.totalDebt || 0,
      totalPaid: allDebts[0]?.totalPaid || 0,
      totalRemaining: allDebts[0]?.totalRemaining || 0,
      count: allDebts[0]?.count || 0,
      overdueCount: overduePurchases,
      dueSoonCount: dueSoonPurchases,
    },
  });
});
