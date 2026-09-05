const { Supplier, Product, Purchase, Sale } = require('../models');
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
  const purchases = await Purchase.find({ supplier: supplier._id })
    .populate('sale', 'saleNumber total paymentMethod')
    .sort('-createdAt')
    .limit(100);
  const stats = await Purchase.aggregate([
    { $match: { supplier: supplier._id } },
    { $group: { _id: '$type', total: { $sum: '$totalAmount' }, remaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
  ]);
  const agg = await Purchase.aggregate([
    { $match: { supplier: supplier._id } },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, remaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
  ]);
  const total = agg[0] || { total: 0, remaining: 0, count: 0 };
  success(res, 'Supplier detail', {
    supplier,
    products,
    purchases,
    stats,
    totalPurchases: total.count || 0,
    totalSpent: total.total || 0,
    totalRemaining: total.remaining || 0,
  });
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