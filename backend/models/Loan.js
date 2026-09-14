const mongoose = require('mongoose');
const { LOAN_STATUSES, LOAN_ITEM_STATUSES } = require('../utils/constants');

const loanItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    sku: String,
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    outstanding: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: LOAN_ITEM_STATUSES, default: 'UNPAID' },
    returned: { type: Boolean, default: false },
    returnedOn: Date,
    returnReason: String,
    returnReference: String,
    returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
);

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
    loanItems: [loanItemSchema],
    dueDate: Date,
    status: { type: String, enum: LOAN_STATUSES, default: 'ACTIVE' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Loan', loanSchema);