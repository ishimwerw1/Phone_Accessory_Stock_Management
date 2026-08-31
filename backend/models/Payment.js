const mongoose = require('mongoose');
const { PAYMENT_METHODS, PAYMENT_STATUSES } = require('../utils/constants');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, unique: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true, min: 0 },
    reference: String,
    status: { type: String, enum: PAYMENT_STATUSES, default: 'PAID' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);