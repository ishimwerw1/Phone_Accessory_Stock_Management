const { User, AuditLog, Session } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { ROLES } = require('../utils/constants');
const { audit } = require('../services/auditService');

exports.getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().lean();
  success(res, 'Users', users.map((u) => {
    const { password, ...rest } = u;
    return { ...rest, roleName: ROLES[u.role]?.name || u.role, permissions: ROLES[u.role]?.permissions || [] };
  }));
});

exports.getRoles = asyncHandler(async (req, res) => {
  success(res, 'Roles', ROLES);
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const exists = await User.findOne({ email: (email || '').toLowerCase() });
  if (exists) return error(res, 'Email already in use');
  const user = await User.create({ name, email, password, role: role || 'CASHIER' });
  await audit(req, 'USER_CREATED', 'User', user._id, { name: user.name, role: user.role });
  success(res, 'User created', user.toSafeJSON(), 201);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, password, isActive } = req.body;
  const user = await User.findById(id);
  if (!user) return error(res, 'User not found', 404);
  if (name) user.name = name;
  if (email) user.email = email.toLowerCase();
  if (role) user.role = role;
  if (password) user.password = password;
  if (typeof isActive === 'boolean') user.isActive = isActive;
  await user.save();
  if ((typeof isActive === 'boolean' && !isActive) || password) {
    await Session.updateMany(
      { user: user._id, active: true },
      { $set: { active: false, revokedAt: new Date(), revokedBy: 'admin' } }
    );
  }
  await audit(req, 'USER_UPDATED', 'User', user._id, { name: user.name, role: user.role });
  success(res, 'User updated', user.toSafeJSON());
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user._id)) return error(res, 'You cannot delete your own account');
  const user = await User.findByIdAndDelete(id);
  if (!user) return error(res, 'User not found', 404);
  await audit(req, 'USER_DELETED', 'User', id, { name: user.name });
  success(res, 'User deleted');
});

exports.getAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, entity, user, from, to } = req.query;
  const filter = {};
  if (search) filter.$or = [{ action: { $regex: search, $options: 'i' } }, { userName: { $regex: search, $options: 'i' } }, { entity: { $regex: search, $options: 'i' } }];
  if (entity) filter.entity = entity;
  if (user) filter.user = user;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to + 'T23:59:59');
  }
  const total = await AuditLog.countDocuments(filter);
  const logs = await AuditLog.find(filter).sort('-date').skip((Number(page) - 1) * Number(limit)).limit(Number(limit));
  success(res, 'Audit logs', { logs, total, pages: Math.ceil(total / Number(limit)) || 1, page: Number(page) });
});