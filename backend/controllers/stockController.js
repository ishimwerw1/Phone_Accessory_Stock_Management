const { Product, StockTransaction, Sale, Supplier } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { nextNumber } = require('../utils/helpers');
const { audit } = require('../services/auditService');
const { notify, checkLowStock } = require('../services/notificationService');

const findProduct = async (id) => {
  const p = await Product.findById(id);
  if (!p) throw Object.assign(new Error('Product not found'), { status: 404 });
  return p;
};

exports.stockIn = asyncHandler(async (req, res) => {
  const { productId, quantity, buyingPrice, reference, reason } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return error(res, 'Quantity must be greater than zero');
  const product = await findProduct(productId);
  const prevQty = product.quantity;
  product.quantity = prevQty + qty;
  if (buyingPrice) product.buyingPrice = Number(buyingPrice);
  await product.save();

  const grn = reference || await nextNumber('GRN');
  await StockTransaction.create({
    product: product._id,
    productName: product.name,
    sku: product.sku,
    type: 'STOCK_IN',
    quantity: qty,
    prevQuantity: prevQty,
    newQuantity: product.quantity,
    reason: reason || 'Stock received from supplier',
    reference: grn,
    performedBy: req.user._id,
  });
  await audit(req, 'STOCK_IN', 'Product', product._id, { name: product.name, grn, qty, prevQty, newQty: product.quantity });
  await notify('STOCK_RECEIVED', `${product.name} — ${qty} units received (GRN ${grn})`, `${product.name} — kinjijwe ${qty} (GRN ${grn})`, { product: product._id });
  success(res, 'Stock received', await Product.findById(product._id), 201);
});

exports.adjust = asyncHandler(async (req, res) => {
  const { productId, actualQuantity, reason } = req.body;
  const actual = Number(actualQuantity);
  if (actual === undefined || actual < 0) return error(res, 'Actual quantity must be zero or greater');
  const product = await findProduct(productId);
  const prevQty = product.quantity;
  const diff = actual - prevQty;
  if (diff === 0) return error(res, 'Actual quantity equals current quantity — no adjustment needed');
  product.quantity = actual;
  await product.save();
  await StockTransaction.create({
    product: product._id,
    productName: product.name,
    sku: product.sku,
    type: 'ADJUSTMENT',
    quantity: Math.abs(diff),
    prevQuantity: prevQty,
    newQuantity: actual,
    reason: reason || 'Manual stock adjustment',
    performedBy: req.user._id,
  });
  await audit(req, 'STOCK_ADJUSTMENT', 'Product', product._id, { name: product.name, oldQty: prevQty, newQty: actual, diff, reason });
  await notify('STOCK_ADJUSTMENT', `${product.name} adjusted by ${diff > 0 ? '+' : ''}${diff} → ${actual}`, `${product.name} yahinduye na ${diff > 0 ? '+' : ''}${diff} → ${actual}`, { product: product._id });
  success(res, 'Stock adjusted', await Product.findById(product._id));
});

exports.damaged = asyncHandler(async (req, res) => {
  const { productId, quantity, reason } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return error(res, 'Quantity must be greater than zero');
  const product = await findProduct(productId);
  if (qty > product.quantity) return error(res, `Cannot mark ${qty} damaged — only ${product.quantity} available`);
  const prevQty = product.quantity;
  product.quantity = prevQty - qty;
  await product.save();
  await StockTransaction.create({
    product: product._id,
    productName: product.name,
    sku: product.sku,
    type: 'DAMAGED',
    quantity: qty,
    prevQuantity: prevQty,
    newQuantity: product.quantity,
    reason: reason || 'Damaged product',
    performedBy: req.user._id,
  });
  await audit(req, 'STOCK_DAMAGED', 'Product', product._id, { name: product.name, qty, prevQty, newQty: product.quantity, reason });
  await notify('DAMAGED_PRODUCT', `${product.name} — ${qty} marked damaged: ${reason || 'n/a'}`, `${product.name} — ${qty} yahombye: ${reason || 'n/a'}`, { product: product._id });
  success(res, 'Damaged stock recorded', await Product.findById(product._id));
});

exports.returnItem = asyncHandler(async (req, res) => {
  const { productId, quantity, reason, saleId } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return error(res, 'Quantity must be greater than zero');
  const product = await findProduct(productId);
  const prevQty = product.quantity;
  product.quantity = prevQty + qty;
  await product.save();
  const sale = saleId ? await Sale.findById(saleId) : null;
  const tx = await StockTransaction.create({
    product: product._id,
    productName: product.name,
    sku: product.sku,
    type: 'RETURN',
    quantity: qty,
    prevQuantity: prevQty,
    newQuantity: product.quantity,
    reason: reason || 'Product returned',
    reference: sale ? sale.saleNumber : '',
    sale: sale?._id,
    performedBy: req.user._id,
  });
  await audit(req, 'PRODUCT_RETURN', 'Product', product._id, { name: product.name, qty, prevQty, newQty: product.quantity, sale: sale?.saleNumber || '—', reason });
  await notify('PRODUCT_RETURN', `${product.name} — ${qty} returned to stock`, `${product.name} — ${qty} byashyizwe mu stock`, { product: product._id, sale: sale?._id });
  success(res, 'Product returned to stock', tx, 201);
});

exports.movements = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, type, product, from, to, search } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (product) filter.product = product;
  if (from || to) filter.date = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to + 'T23:59:59') }) };
  if (search) filter.$or = [{ productName: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }, { reference: { $regex: search, $options: 'i' } }, { reason: { $regex: search, $options: 'i' } }];
  const total = await StockTransaction.countDocuments(filter);
  const txns = await StockTransaction.find(filter)
    .populate('performedBy', 'name')
    .sort('-date')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  success(res, 'Stock movements', { txns, total });
});

exports.summary = asyncHandler(async (req, res) => {
  const [stockIn] = await StockTransaction.aggregate([{ $match: { type: 'STOCK_IN' } }, { $group: { _id: null, qty: { $sum: '$quantity' }, count: { $sum: 1 } } }]);
  const [stockOut] = await StockTransaction.aggregate([{ $match: { type: 'SALE' } }, { $group: { _id: null, qty: { $sum: '$quantity' }, count: { $sum: 1 } } }]);
  const low = await Product.find({ status: 'ACTIVE', quantity: { $gt: 0 }, $expr: { $lte: ['$quantity', '$minStock'] } });
  const out = await Product.find({ quantity: { $lte: 0 }, status: 'ACTIVE' });
  success(res, 'Stock summary', {
    stockIn: stockIn?.qty || 0, stockInCount: stockIn?.count || 0,
    stockOut: stockOut?.qty || 0, stockOutCount: stockOut?.count || 0,
    lowStock: low.length, outOfStock: out.length,
  });
});