const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true },
    purchaseNumber: String,
    purchaseItem: { type: mongoose.Schema.Types.ObjectId },
    itemName: String,
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: String,
    amount: { type: Number, required: true, min: 0 },
    previousRemaining: { type: Number, required: true },
    newRemaining: { type: Number, required: true },
    type: { type: String, enum: ['PAYMENT', 'REFUND'], default: 'PAYMENT' },
    paymentMethod: { type: String, enum: ['CASH', 'MOMO', 'BANK'], default: 'CASH' },
    reference: String,
    note: String,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

supplierPaymentSchema.index({ purchase: 1 });
supplierPaymentSchema.index({ purchaseItem: 1 });
supplierPaymentSchema.index({ supplier: 1 });
supplierPaymentSchema.index({ date: -1 });

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
