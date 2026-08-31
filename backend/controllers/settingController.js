const { Setting } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');

exports.getAll = asyncHandler(async (req, res) => {
  const rows = await Setting.find().lean();
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  success(res, 'Settings', obj);
});

exports.update = asyncHandler(async (req, res) => {
  const patches = req.body;
  if (!patches || typeof patches !== 'object' || Array.isArray(patches)) return error(res, 'Send settings as { key: value }');
  await Promise.all(
    Object.entries(patches).map(async ([key, value]) => {
      await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
    })
  );
  await audit(req, 'SETTINGS_UPDATED', 'Setting', null, { keys: Object.keys(patches) });
  const rows = await Setting.find().lean();
  const obj = {};
  rows.forEach((r) => { obj[r.key] = r.value; });
  success(res, 'Settings updated', obj);
});