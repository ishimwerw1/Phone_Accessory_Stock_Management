const router = require('express').Router();
const c = require('../controllers/exchangeRateController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getRates);
router.post('/refresh', auth, permission(PERMISSIONS.SETTINGS_UPDATE), c.refresh);

module.exports = router;