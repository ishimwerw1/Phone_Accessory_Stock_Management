const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    description: String,
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, parent: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);