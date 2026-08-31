const { Brand, PhoneModel } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const brands = await Brand.find().sort('name');
  success(res, 'Brands', brands);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) return error(res, 'Brand name is required');
  const dup = await Brand.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
  if (dup) return error(res, 'Brand already exists');
  const brand = await Brand.create({ name, description });
  await audit(req, 'BRAND_CREATED', 'Brand', brand._id, { name: brand.name });
  success(res, 'Brand created', brand, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const brand = await Brand.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!brand) return error(res, 'Brand not found', 404);
  await audit(req, 'BRAND_UPDATED', 'Brand', id, req.body);
  success(res, 'Brand updated', brand);
});

exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await PhoneModel.updateMany({ brand: id }, { isActive: false });
  const brand = await Brand.findByIdAndDelete(id);
  if (!brand) return error(res, 'Brand not found', 404);
  await audit(req, 'BRAND_DELETED', 'Brand', id, { name: brand.name });
  success(res, 'Brand deleted');
});