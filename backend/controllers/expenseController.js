const { Expense } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const { search, category, paymentMethod, user, from, to, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ title: re }, { description: re }];
  }
  if (category) filter.category = category;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (user) filter.createdBy = user;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to + 'T23:59:59');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [expenses, total] = await Promise.all([
    Expense.find(filter).populate('createdBy', 'name role').populate('updatedBy', 'name').sort('-date').skip(skip).limit(Number(limit)),
    Expense.countDocuments(filter),
  ]);

  success(res, 'Expenses', { expenses, total, pages: Math.ceil(total / Number(limit)) || 1, page: Number(page) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id).populate('createdBy', 'name role').populate('updatedBy', 'name');
  if (!expense) return error(res, 'Expense not found', 404);
  success(res, 'Expense', expense);
});

exports.create = asyncHandler(async (req, res) => {
  const { title, category, amount, paymentMethod, date, description } = req.body;
  if (!title || !category || amount === undefined) {
    return error(res, 'Title, category, and amount are required');
  }
  if (Number(amount) <= 0) return error(res, 'Amount must be greater than 0');

  const expense = await Expense.create({
    title, category, amount: Number(amount), paymentMethod, date, description,
    createdBy: req.user._id,
  });
  await expense.populate('createdBy', 'name role');
  await audit(req, 'EXPENSE_CREATED', 'Expense', expense._id, { title, category, amount });
  success(res, 'Expense created', expense, 201);
});

exports.update = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return error(res, 'Expense not found', 404);

  const { title, category, amount, paymentMethod, date, description } = req.body;
  if (amount !== undefined && Number(amount) <= 0) return error(res, 'Amount must be greater than 0');

  if (title) expense.title = title;
  if (category) expense.category = category;
  if (amount !== undefined) expense.amount = Number(amount);
  if (paymentMethod) expense.paymentMethod = paymentMethod;
  if (date) expense.date = date;
  if (description !== undefined) expense.description = description;
  expense.updatedBy = req.user._id;

  await expense.save();
  await expense.populate('createdBy', 'name role');
  await audit(req, 'EXPENSE_UPDATED', 'Expense', expense._id, { title: expense.title, category: expense.category, amount: expense.amount });
  success(res, 'Expense updated', expense);
});

exports.remove = asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) return error(res, 'Expense not found', 404);
  await audit(req, 'EXPENSE_DELETED', 'Expense', expense._id, { title: expense.title, category: expense.category, amount: expense.amount });
  success(res, 'Expense deleted');
});

exports.summary = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayTotal, weekTotal, monthTotal, byCategory, byUser] = await Promise.all([
    Expense.aggregate([{ $match: { date: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { date: { $gte: weekStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Expense.aggregate([
      { $match: { date: { $gte: monthStart } } },
      { $group: { _id: '$createdBy', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { _id: 1, total: 1, count: 1, name: { $arrayElemAt: ['$u.name', 0] } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  success(res, 'Expense summary', {
    today: todayTotal[0]?.total || 0,
    thisWeek: weekTotal[0]?.total || 0,
    thisMonth: monthTotal[0]?.total || 0,
    byCategory,
    byUser,
  });
});
