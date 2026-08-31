const router = require('express').Router();
const c = require('../controllers/settingController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, permission(PERMISSIONS.SETTINGS_READ), c.getAll);
router.put('/', auth, permission(PERMISSIONS.SETTINGS_UPDATE), c.update);

module.exports = router;