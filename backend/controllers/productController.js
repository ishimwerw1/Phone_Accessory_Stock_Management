const { Product, StockTransaction, Sale, Supplier, Brand, PhoneModel, Category } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { nextNumber } = require('../utils/helpers');

const populate = [
  { path: 'category', select: 'name parent' },
  { path: 'subcategory', select: 'name' },
  { path: 'brand', select: 'name' },
  { path: 'compatibleModels', select: 'name brand', populate: { path: 'brand', select: 'name' } },
  { path: 'supplier', select: 'name company phone email' },
];

const buildFilter = (q = {}) => {
  const filter = {};
  const { search, brand, model, category, subcategory, partType, condition, supplier, stockStatus, minPrice, maxPrice, status } = q;
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { name: re }, { sku: re }, { barcode: re }, { partType: re },
    ];
  }
  if (brand) filter.brand = brand;
  if (model) filter.compatibleModels = model;
  if (category) filter.category = category;
  if (subcategory) filter.subcategory = subcategory;
  if (partType) filter.partType = { $regex: partType, $options: 'i' };
  if (condition) filter.condition = condition;
  if (supplier) filter.supplier = supplier;
  if (status) filter.status = status;
  if (minPrice || maxPrice) filter.sellingPrice = { ...(minPrice && { $gte: Number(minPrice) }), ...(maxPrice && { $lte: Number(maxPrice) }) };

  if (stockStatus) {
    const products = filter;
    if (stockStatus === 'OUT_OF_STOCK') products.quantity = { $lte: 0 };
    else if (stockStatus === 'LOW_STOCK') {
      products.$expr = { $and: [{ $gt: ['$quantity', 0] }, { $lte: ['$quantity', '$minStock'] }] };
    }
  }
  return filter;
};

exports.getAll = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20, ...rest } = req.query;
  const filter = buildFilter(rest);
  if (search !== undefined && search !== '') {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { name: re }, { sku: re }, { barcode: re }, { partType: re },
      { condition: re },
      { 'brandModelSearch': re },
    ];
    const brandIds = (await Brand.find({ name: re }).select('_id')).map((b) => b._id);
    const modelIds = (await PhoneModel.find({ name: re }).select('_id')).map((m) => m._id);
    const catIds = (await Category.find({ name: re }).select('_id')).map((c) => c._id);
    const supIds = (await Supplier.find({ $or: [{ name: re }, { company: re }] }).select('_id')).map((s) => s._id);
    filter.$or = [
      { name: re }, { sku: re }, { barcode: re }, { partType: re },
      ...(brandIds.length ? [{ brand: { $in: brandIds } }] : []),
      ...(modelIds.length ? [{ compatibleModels: { $in: modelIds } }] : []),
      ...(catIds.length ? [{ category: { $in: catIds } }] : []),
      ...(supIds.length ? [{ supplier: { $in: supIds } }] : []),
    ];
  }
  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .populate(populate)
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  success(res, 'Products', { products, total, page: Number(page), limit: Number(limit) });
});

exports.getAutocomplete = asyncHandler(async (req, res) => {
  const { q = '', limit = 15 } = req.query;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const brandIds = (await Brand.find({ name: re }).select('_id')).map((b) => b._id);
  const modelIds = (await PhoneModel.find({ name: re }).select('_id')).map((m) => m._id);
  const catIds = (await Category.find({ name: re }).select('_id')).map((c) => c._id);
  const filter = {
    status: 'ACTIVE',
    $or: [
      { name: re }, { sku: re }, { barcode: re }, { partType: re },
      ...(brandIds.length ? [{ brand: { $in: brandIds } }] : []),
      ...(modelIds.length ? [{ compatibleModels: { $in: modelIds } }] : []),
      ...(catIds.length ? [{ category: { $in: catIds } }] : []),
    ],
  };
  const products = await Product.find(filter).populate(populate).sort('-quantity').limit(Number(limit));
  success(res, 'Products', products);
});

exports.getOne = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(populate);
  if (!product) return error(res, 'Product not found', 404);
  const stockTx = await StockTransaction.find({ product: product._id })
    .populate('performedBy', 'name')
    .sort('-date')
    .limit(50);
  const sales = await Sale.find({ 'items.product': product._id })
    .populate('customer', 'name phone')
    .sort('-createdAt')
    .limit(50);
  success(res, 'Product', { product, stockTx, sales });
});

exports.create = asyncHandler(async (req, res) => {
  let sku = (req.body.sku || '').trim().toUpperCase();
  if (!sku) {
    let attempts = 5;
    while (attempts--) {
      sku = await nextNumber('SP');
      if (!(await Product.exists({ sku }))) break;
    }
  } else {
    const dup = await Product.findOne({ sku });
    if (dup) return error(res, `SKU ${sku} already exists`);
  }
  const product = await Product.create({ ...req.body, sku });
  if (product.quantity > 0) {
    await StockTransaction.create({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      type: 'OPENING_STOCK',
      quantity: product.quantity,
      prevQuantity: 0,
      newQuantity: product.quantity,
      reason: 'Opening stock',
      performedBy: req.user._id,
    });
    await audit(req, 'PRODUCT_CREATED', 'Product', product._id, { name: product.name, openingQty: product.quantity });
  } else {
    await audit(req, 'PRODUCT_CREATED', 'Product', product._id, { name: product.name });
  }
  success(res, 'Product created', await Product.findById(product._id).populate(populate), 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) return error(res, 'Product not found', 404);
  if (req.body.sku !== undefined && (req.body.sku || '').trim()) {
    const newSku = req.body.sku.trim().toUpperCase();
    if (newSku !== product.sku) {
      const dup = await Product.findOne({ sku: newSku, _id: { $ne: id } });
      if (dup) return error(res, `SKU ${newSku} already exists`);
      req.body.sku = newSku;
    } else {
      delete req.body.sku;
    }
  } else {
    delete req.body.sku;
  }
  Object.assign(product, req.body);
  await product.save();
  await audit(req, 'PRODUCT_UPDATED', 'Product', id, req.body);
  success(res, 'Product updated', await Product.findById(id).populate(populate));
});

exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByIdAndUpdate(id, { status: 'INACTIVE' }, { new: true });
  if (!product) return error(res, 'Product not found', 404);
  await audit(req, 'PRODUCT_DEACTIVATED', 'Product', id, { name: product.name });
  success(res, 'Product deactivated');
});