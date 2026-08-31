const { PhoneModel, Brand } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.brand) filter.brand = req.query.brand;
  const models = await PhoneModel.find(filter).populate('brand', 'name').sort('name');
  success(res, 'Phone models', models);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, brand } = req.body;
  if (!name || !brand) return error(res, 'Model name and brand are required');
  const dup = await PhoneModel.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, brand });
  if (dup) return error(res, 'This model already exists for the selected brand');
  const pm = await PhoneModel.create({ name, brand });
  await audit(req, 'PHONEMODEL_CREATED', 'PhoneModel', pm._id, { name: pm.name, brand });
  success(res, 'Phone model created', pm, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pm = await PhoneModel.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!pm) return error(res, 'Phone model not found', 404);
  await audit(req, 'PHONEMODEL_UPDATED', 'PhoneModel', id, req.body);
  success(res, 'Phone model updated', pm);
});

exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pm = await PhoneModel.findByIdAndDelete(id);
  if (!pm) return error(res, 'Phone model not found', 404);
  await audit(req, 'PHONEMODEL_DELETED', 'PhoneModel', id, { name: pm.name });
  success(res, 'Phone model deleted');
});

exports.listByBrand = asyncHandler(async (req, res) => {
  const brands = await Brand.find().sort('name').lean();
  const models = await PhoneModel.find().populate('brand', 'name').lean();
  const map = brands.map((b) => ({
    brand: b,
    models: models.filter((m) => String(m.brand?._id) === String(b._id)),
  }));
  success(res, 'Models by brand', map);
});