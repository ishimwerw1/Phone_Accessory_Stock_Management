const { Category } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const cats = await Category.find().populate('parent', 'name').sort('name');
  const tree = cats.filter((c) => !c.parent);
  const withChildren = tree.map((c) => ({
    ...c.toObject(),
    children: cats.filter((x) => x.parent && String(x.parent._id) === String(c._id)),
  }));
  success(res, 'Categories', withChildren);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, parent } = req.body;
  if (!name) return error(res, 'Category name is required');
  const dup = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, parent: parent || null });
  if (dup) return error(res, 'Category already exists');
  const cat = await Category.create({ name, parent: parent || null });
  await audit(req, 'CATEGORY_CREATED', 'Category', cat._id, { name: cat.name, parent });
  success(res, 'Category created', cat, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cat = await Category.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!cat) return error(res, 'Category not found', 404);
  await audit(req, 'CATEGORY_UPDATED', 'Category', id, req.body);
  success(res, 'Category updated', cat);
});

exports.remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const children = await Category.find({ parent: id });
  if (children.length) return error(res, 'Cannot delete a category that has subcategories');
  const cat = await Category.findByIdAndDelete(id);
  if (!cat) return error(res, 'Category not found', 404);
  await audit(req, 'CATEGORY_DELETED', 'Category', id, { name: cat.name });
  success(res, 'Category deleted');
});