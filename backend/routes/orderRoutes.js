const router = require('express').Router();
const c = require('../controllers/orderController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, permission(PERMISSIONS.ORDERS_READ), c.getAll);
router.get('/:id', auth, permission(PERMISSIONS.ORDERS_READ), c.getOne);
router.post('/', auth, permission(PERMISSIONS.ORDERS_CREATE), c.create);
router.post('/:id/fulfill', auth, permission(PERMISSIONS.ORDERS_UPDATE), c.fulfill);
router.put('/:id/status', auth, permission(PERMISSIONS.ORDERS_UPDATE), c.updateStatus);
router.put('/:id/cancel', auth, permission(PERMISSIONS.ORDERS_CANCEL), c.cancel);

module.exports = router;
