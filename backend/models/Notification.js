const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'LOW_STOCK', 'OUT_OF_STOCK', 'NEW_SALE', 'NEW_ORDER', 'NEW_LOAN',
        'LOAN_REPAYMENT', 'OVERDUE_LOAN', 'STOCK_RECEIVED', 'STOCK_ADJUSTMENT',
        'PRODUCT_RETURN', 'DAMAGED_PRODUCT', 'SYSTEM',
      ],
    },
    message: { type: String, required: true },
    messageRw: String,
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);