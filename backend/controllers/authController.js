const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return error(res, 'Email and password are required');
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.comparePassword(password))) {
    return error(res, 'Invalid email or password', 401);
  }
  if (!user.isActive) return error(res, 'Account is deactivated. Contact an administrator.', 403);
  req.user = user.toSafeJSON();
  await audit(req, 'LOGIN', 'User', user._id, { email: user.email });
  return success(res, 'Login successful', { token: signToken(user), user: user.toSafeJSON() });
});

exports.me = asyncHandler(async (req, res) => {
  return success(res, 'Current user', { user: req.user });
});