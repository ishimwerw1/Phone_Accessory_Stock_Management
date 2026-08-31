const router = require('express').Router();
const c = require('../controllers/stockController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/movements', auth, c.movements);
router.get('/summary', auth, c.summary);
router.post('/in', auth, permission(PERMISSIONS.STOCK_CREATE), c.stockIn);
router.post('/adjust', auth, permission(PERMISSIONS.STOCK_ADJUST), c.adjust);
router.post('/damaged', auth, permission(PERMISSIONS.STOCK_DAMAGED), c.damaged);
router.post('/returns', auth, permission(PERMISSIONS.STOCK_RETURN), c.returnItem);

module.exports = router;