const mongoose = require('mongoose');
const { Purchase, Product, StockTransaction, SupplierPayment, Supplier } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { nextNumber } = require('../utils/helpers');

exports.getAll = asyncHandler(async (req, res) => {
  const { search, supplier, paymentStatus, status, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ purchaseNumber: re }, { supplierName: re }, { notes: re }];
  }
  if (supplier) filter.supplier = supplier;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (status) filter.status = status;
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
    .populate('createdBy', 'name');
  if (!purchase) return error(res, 'Purchase not found', 404);
  const payments = await SupplierPayment.find({ purchase: purchase._id }).populate('receivedBy', 'name').sort('-date');
  success(res, 'Purchase', { purchase, payments });
});

exports.create = asyncHandler(async (req, res) => {
  const { supplier: supplierId, items, paymentMethod, amountPaid, dueDate, notes } = req.body;

  if (!supplierId || !items || !items.length) {
    return error(res, 'Supplier and at least one item are required');
  }

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) return error(res, 'Supplier not found', 404);

  let totalAmount = 0;
  const purchaseItems = [];

  for (const item of items) {
    if (!item.product || !item.quantity || !item.costPrice) {
      return error(res, 'Each item must have product, quantity, and costPrice');
    }
    if (Number(item.quantity) <= 0) return error(res, 'Quantity must be greater than 0');
    if (Number(item.costPrice) < 0) return error(res, 'Cost price cannot be negative');

    const product = await Product.findById(item.product);
    if (!product) return error(res, `Product not found: ${item.product}`);

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

  const { dueDate, notes, status } = req.body;
  if (dueDate) purchase.dueDate = dueDate;
  if (notes !== undefined) purchase.notes = notes;
  if (status && status !== 'CANCELLED') purchase.status = status;
  purchase.updatedBy = req.user._id;

  await purchase.save();
  await audit(req, 'PURCHASE_UPDATED', 'Purchase', purchase._id, { purchaseNumber: purchase.purchaseNumber });
  success(res, 'Purchase updated', purchase);
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
