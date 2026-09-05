const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: String,
    sku: String,
    quantity: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true },
  },
  { _id: true }
);

const PURCHASE_STATUSES = ['PENDING', 'RECEIVED', 'CANCELLED'];
const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];
const PURCHASE_TYPES = ['NORMAL', 'ON_DEMAND'];

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: String,
    supplierPhone: String,
    items: [purchaseItemSchema],
    totalAmount: { type: Number, required: true, default: 0 },
    paymentMethod: { type: String, enum: ['CASH', 'MOMO', 'BANK', 'CREDIT'], default: 'CASH' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PAID' },
    amountPaid: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    dueDate: Date,
    status: { type: String, enum: PURCHASE_STATUSES, default: 'RECEIVED' },
    type: { type: String, enum: PURCHASE_TYPES, default: 'NORMAL' },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ paymentStatus: 1 });
purchaseSchema.index({ dueDate: 1 });
purchaseSchema.index({ createdBy: 1 });
purchaseSchema.index({ type: 1 });
purchaseSchema.index({ sale: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
module.exports.PURCHASE_STATUSES = PURCHASE_STATUSES;
module.exports.PURCHASE_PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.PURCHASE_TYPES = PURCHASE_TYPES;
