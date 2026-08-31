const { AuditLog } = require('../models');

const audit = async (req, action, entity, entityId, details = {}) => {
  try {
    const user = req.user || (req._userSafe || null);
    await AuditLog.create({
      user: user ? user._id : null,
      userName: user ? `${user.name} (${user.role})` : 'System',
      action,
      entity,
      entityId: entityId || undefined,
      details,
      date: new Date(),
    });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
};

module.exports = { audit };