const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many requests, please slow down' },
  standardHeaders: true,
});

module.exports = { authLimiter, generalLimiter };