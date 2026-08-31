const Counter = require('../models/Counter');

const pad = (n, len = 4) => String(n).padStart(len, '0');

const nextNumber = async (prefix, opts = {}) => {
  const doc = await Counter.findOneAndUpdate(
    { prefix },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, ...opts, timestamps: false }
  );
  return `${prefix}-${pad(doc.seq)}`;
};

const fmtMoney = (n) => Number(n || 0).toLocaleString('en-US');

module.exports = { nextNumber, fmtMoney, pad };