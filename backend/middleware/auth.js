const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return error(res, 'Not authenticated', 401);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { User } = require('../models');
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return error(res, 'User not found or deactivated', 401);
    req.user = user.toSafeJSON();
    next();
  } catch (e) {
    return error(res, 'Invalid or expired token', 401);
  }
};

const permission = (...perms) => (req, res, next) => {
  const user = req.user;
  if (!user) return error(res, 'Not authenticated', 401);
  const required = perms.flat();
  const has = required.some((p) => user.permissions.includes(p));
  if (!has) return error(res, 'Access denied: insufficient permissions', 403);
  next();
};

module.exports = { auth, permission };