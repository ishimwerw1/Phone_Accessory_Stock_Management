const success = (res, message, data = {}, status = 200) =>
  res.status(status).json({ success: true, message, data });

const error = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { success, error, asyncHandler };