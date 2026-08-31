const { Notification } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');

exports.getAll = asyncHandler(async (req, res) => {
  const notifications = await Notification.find().sort('-createdAt').limit(100);
  const unread = await Notification.countDocuments({ read: false });
  success(res, 'Notifications', { notifications, unread });
});

exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ _id: req.body.ids || [] }, { read: true });
  success(res, 'Notifications marked as read');
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({}, { read: true });
  success(res, 'All notifications marked as read');
});

exports.remove = asyncHandler(async (req, res) => {
  await Notification.findByIdAndDelete(req.params.id);
  success(res, 'Notification deleted');
});