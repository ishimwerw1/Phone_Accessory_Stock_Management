const mongoose = require('mongoose');
const { LOAN_STATUSES } = require('../utils/constants');

const loanSchema = new mongoose.Schema(
  {
    loanNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: String,
    customerPhone: String,
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    totalAmount: { type: Number, required: true, default: 0 },
    amountPaid: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    dueDate: Date,
    status: { type: String, enum: LOAN_STATUSES, default: 'ACTIVE' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Loan', loanSchema);