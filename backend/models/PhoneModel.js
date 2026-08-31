const mongoose = require('mongoose');

const phoneModelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

phoneModelSchema.index({ brand: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PhoneModel', phoneModelSchema);