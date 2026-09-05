const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    device: { type: String, default: 'Unknown device' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, enum: ['logout', 'password_change', 'admin', 'revoked'], default: 'revoked' },
  },
  { timestamps: false }
);

sessionSchema.index({ user: 1, active: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);