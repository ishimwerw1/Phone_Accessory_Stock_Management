const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return error(res, 'Not authenticated', 401);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id || !decoded.jti) return error(res, 'Session invalid, please log in again', 401);

    const { User, Session } = require('../models');
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return error(res, 'User not found or deactivated', 401);

    const session = await Session.findOne({ jti: decoded.jti });
    if (
      !session ||
      !session.active ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      String(session.user) !== String(user._id)
    ) {
      return error(res, 'Session expired or revoked, please log in again', 401);
    }

    if (Date.now() - new Date(session.lastActiveAt).getTime() > 60000) {
      session.lastActiveAt = new Date();
      session.save().catch(() => {});
    }

    req.session = session;
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