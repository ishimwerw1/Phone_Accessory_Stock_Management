const mongoose = require('mongoose');

const EXPENSE_CATEGORIES = [
  'Transport', 'Rent', 'Food', 'Electricity', 'Water', 'Salaries',
  'Maintenance', 'Airtime', 'Internet', 'Shop Expenses', 'Packaging',
  'Delivery', 'Repair Tools', 'Other'
];

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: EXPENSE_CATEGORIES },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'MOMO', 'BANK'], default: 'CASH' },
    date: { type: Date, default: Date.now },
    description: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ category: 1 });
expenseSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
