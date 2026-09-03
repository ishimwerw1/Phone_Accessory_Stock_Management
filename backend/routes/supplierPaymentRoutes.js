const router = require('express').Router();
const c = require('../controllers/supplierPaymentController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, permission(PERMISSIONS.PURCHASES_READ), c.getAll);
router.post('/', auth, permission(PERMISSIONS.PURCHASES_CREATE), c.create);

module.exports = router;
