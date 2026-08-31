const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
    compatibleModels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PhoneModel' }],
    partType: { type: String, trim: true },
    condition: {
      type: String,
      enum: ['NEW', 'ORIGINAL', 'OEM', 'USED', 'REFURBISHED', 'COMPATIBLE'],
      default: 'NEW',
    },
    description: String,
    buyingPrice: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: { type: Number, required: true, min: 0, default: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, default: 5 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    location: String,
    image: String,
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

productSchema.virtual('stockStatus').get(function () {
  if (this.quantity <= 0) return 'OUT_OF_STOCK';
  if (this.quantity <= this.minStock) return 'LOW_STOCK';
  return 'IN_STOCK';
});

productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);