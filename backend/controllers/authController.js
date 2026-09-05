const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User, Session } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

const signToken = (user, jti) =>
  jwt.sign({ id: user._id, role: user.role, jti }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sessionExpiry = () => {
  const days = parseInt(process.env.JWT_EXPIRES_IN || '7d', 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip || req.socket?.remoteAddress || '';

const describeDevice = (ua = '') => {
  if (!ua) return 'Unknown device';
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  let browser = 'Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/opera|opr\//i.test(ua)) browser = 'Opera';
  else if (/safari/i.test(ua)) browser = 'Safari';
  const mobile = /mobile/i.test(ua) ? ' Mobile' : '';
  return `${browser} on ${os}${mobile}`;
};

const issueSession = async (req, user) => {
  const jti = crypto.randomUUID();
  await Session.create({
    user: user._id,
    jti,
    ip: clientIp(req),
    userAgent: (req.headers['user-agent'] || '').slice(0, 300),
    device: describeDevice(req.headers['user-agent']),
    expiresAt: sessionExpiry(),
  });
  return jti;
};

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return error(res, 'Email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    return error(res, 'Invalid email or password', 401);
  }
  if (!user.isActive) return error(res, 'Account is deactivated. Contact an administrator.', 403);
  req.user = user.toSafeJSON();
  const jti = await issueSession(req, user);
  await audit(req, 'LOGIN', 'User', user._id, { email: user.email });
  return success(res, 'Login successful', { token: signToken(user, jti), user: user.toSafeJSON() });
});

exports.me = asyncHandler(async (req, res) => {
  return success(res, 'Current user', { user: req.user });
});

exports.logout = asyncHandler(async (req, res) => {
  await Session.updateOne(
    { jti: req.session?.jti },
    { $set: { active: false, revokedAt: new Date(), revokedBy: 'logout' } }
  );
  await audit(req, 'LOGOUT', 'Session', req.session?._id, {});
  return success(res, 'Logged out');
});

exports.getSessions = asyncHandler(async (req, res) => {
  const now = new Date();
  const sessions = await Session.find({ user: req.user._id, active: true, expiresAt: { $gt: now } })
    .sort('-lastActiveAt')
    .lean();
  const list = sessions.map((s) => ({
    _id: s._id,
    device: s.device,
    ip: s.ip,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    expiresAt: s.expiresAt,
    isCurrent: s.jti === req.session?.jti,
  }));
  return success(res, 'Active sessions', list);
});

exports.revokeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const session = await Session.findOne({ _id: id, user: req.user._id });
  if (!session) return error(res, 'Session not found', 404);
  const current = session.jti === req.session?.jti;
  await Session.updateOne(
    { _id: session._id },
    { $set: { active: false, revokedAt: new Date(), revokedBy: 'revoked' } }
  );
  await audit(req, current ? 'LOGOUT' : 'SESSION_REVOKED', 'Session', session._id, { current });
  return success(res, 'Session revoked', { revokedCurrent: current });
});

exports.revokeOthers = asyncHandler(async (req, res) => {
  await Session.updateMany(
    { user: req.user._id, active: true, jti: { $ne: req.session?.jti } },
    { $set: { active: false, revokedAt: new Date(), revokedBy: 'revoked' } }
  );
  await audit(req, 'SESSIONS_REVOKED_OTHERS', 'User', req.user._id, {});
  return success(res, 'All other sessions ended');
});

exports.updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) return error(res, 'User not found', 404);
  if (name !== undefined) {
    const clean = String(name).trim();
    if (!clean) return error(res, 'Name cannot be empty');
    user.name = clean;
  }
  if (email !== undefined) {
    const clean = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return error(res, 'Enter a valid email address');
    const existing = await User.findOne({ email: clean });
    if (existing && String(existing._id) !== String(user._id)) return error(res, 'Email already in use');
    user.email = clean;
  }
  await user.save();
  await audit(req, 'PROFILE_UPDATED', 'User', user._id, { name: user.name, email: user.email });
  return success(res, 'Profile updated', { user: user.toSafeJSON() });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return error(res, 'Current and new password are required');
  if (String(newPassword).length < 6) return error(res, 'New password must be at least 6 characters');
  const user = await User.findById(req.user._id);
  if (!user) return error(res, 'User not found', 404);
  if (!(await user.comparePassword(currentPassword))) return error(res, 'Current password is incorrect', 401);
  user.password = newPassword;
  await user.save();
  await Session.updateMany(
    { user: user._id, active: true, jti: { $ne: req.session?.jti } },
    { $set: { active: false, revokedAt: new Date(), revokedBy: 'password_change' } }
  );
  await audit(req, 'PASSWORD_CHANGED', 'User', user._id, {});
  return success(res, 'Password changed. You have been signed out from other devices.');
});