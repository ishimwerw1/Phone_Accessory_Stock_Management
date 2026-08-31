const router = require('express').Router();
const c = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');
const { permission } = require('../middleware/auth');

router.get('/', auth, permission(PERMISSIONS.NOTIFICATIONS_READ), c.getAll);
router.post('/read', auth, permission(PERMISSIONS.NOTIFICATIONS_READ), c.markRead);
router.post('/read-all', auth, permission(PERMISSIONS.NOTIFICATIONS_READ), c.markAllRead);
router.delete('/:id', auth, permission(PERMISSIONS.NOTIFICATIONS_READ), c.remove);

module.exports = router;