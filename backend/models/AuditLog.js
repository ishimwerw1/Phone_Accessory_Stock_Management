const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    action: { type: String, required: true },
    entity: String,
    entityId: mongoose.Schema.Types.ObjectId,
    details: mongoose.Schema.Types.Mixed,
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);