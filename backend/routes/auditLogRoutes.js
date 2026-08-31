const router = require('express').Router();
const c = require('../controllers/userController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, permission(PERMISSIONS.AUDITLOGS_READ), c.getAuditLogs);

module.exports = router;