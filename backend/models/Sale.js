const mongoose = require('mongoose');
const { PAYMENT_METHODS, PAYMENT_STATUSES, SALE_STATUSES, SALE_SOURCES } = require('../utils/constants');

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    sku: String,
    brandName: String,
    modelName: String,
    partType: String,
    condition: String,
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true },
    cost: Number,
  },
  { _id: true }
);

const saleSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: String,
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [saleItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'CASH' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'UNPAID' },
    source: { type: String, enum: SALE_SOURCES, default: 'RETAIL', index: true },
    amountPaid: { type: Number, default: 0 },
    outstanding: { type: Number, default: 0 },
    reference: String,
    status: { type: String, enum: SALE_STATUSES, default: 'COMPLETED' },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', saleSchema);