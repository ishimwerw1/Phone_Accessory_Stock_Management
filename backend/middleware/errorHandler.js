const { error } = require('../utils/response');

const notFound = (req, res) => error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error('ERROR:', err.message);
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return error(res, `Duplicate value for ${field} — record already exists`, 400);
  }
  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map((e) => e.message).join(', ');
    return error(res, msg, 400);
  }
  if (err.name === 'CastError') return error(res, 'Invalid ID format', 400);
  return error(res, err.message || 'Internal server error', err.status || 500);
};

module.exports = { notFound, errorHandler };