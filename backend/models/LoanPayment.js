const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../utils/constants');

const loanPaymentSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
    loanNumber: String,
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    amount: { type: Number, required: true, min: 1 },
    previousOutstanding: { type: Number, default: 0 },
    newOutstanding: { type: Number, default: 0 },
    method: { type: String, enum: PAYMENT_METHODS, default: 'CASH' },
    reference: String,
    note: String,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoanPayment', loanPaymentSchema);