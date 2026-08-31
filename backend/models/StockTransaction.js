const mongoose = require('mongoose');
const { STOCK_TYPES } = require('../utils/constants');

const stockTransactionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: String,
    sku: String,
    type: { type: String, enum: STOCK_TYPES, required: true },
    quantity: { type: Number, required: true },
    prevQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    reason: String,
    reference: String,
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);