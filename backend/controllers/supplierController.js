const { Supplier, Product, StockTransaction, Sale } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ name: re }, { company: re }, { phone: re }, { email: re }];
  }
  const suppliers = await Supplier.find(filter).sort('-createdAt');
  success(res, 'Suppliers', suppliers);
});

exports.getOne = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) return error(res, 'Supplier not found', 404);
  const products = await Product.find({ supplier: supplier._id })
    .populate('category', 'name')
    .populate('brand', 'name')
    .sort('-createdAt');
  const purchases = await StockTransaction.find({ type: 'STOCK_IN', product: { $in: products.map((p) => p._id) } })
    .populate('product', 'name sku')
    .populate('performedBy', 'name')
    .sort('-date')
    .limit(100);
  const totalPurchases = purchases.reduce((s, p) => s + (p.quantity * (p.newQuantity >= p.prevQuantity ? 0 : 0)), 0);
  const spent = await StockTransaction.aggregate([
    { $match: { type: 'STOCK_IN', product: { $in: products.map((p) => p._id) } } },
    { $group: { _id: null, qty: { $sum: '$quantity' } } },
  ]);
  success(res, 'Supplier detail', { supplier, products, purchases, totalQuantity: spent[0]?.qty || 0, totalPurchases });
});

exports.create = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return error(res, 'Supplier name is required');
  const supplier = await Supplier.create(req.body);
  await audit(req, 'SUPPLIER_CREATED', 'Supplier', supplier._id, { name: supplier.name });
  success(res, 'Supplier created', supplier, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!supplier) return error(res, 'Supplier not found', 404);
  await audit(req, 'SUPPLIER_UPDATED', 'Supplier', req.params.id, req.body);
  success(res, 'Supplier updated', supplier);
});

exports.remove = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) return error(res, 'Supplier not found', 404);
  await Product.updateMany({ supplier: supplier._id }, { $set: { supplier: null } });
  await audit(req, 'SUPPLIER_DELETED', 'Supplier', supplier._id, { name: supplier.name });
  success(res, 'Supplier deleted');
});