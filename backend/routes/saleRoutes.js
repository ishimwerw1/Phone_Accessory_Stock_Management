const router = require('express').Router();
const c = require('../controllers/saleController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getAll);
router.get('/invoice/:id', auth, c.invoice);
router.get('/:id', auth, c.getOne);
router.post('/', auth, permission(PERMISSIONS.SALES_CREATE), c.create);
router.delete('/:id/cancel', auth, permission(PERMISSIONS.SALES_CANCEL), c.cancel);

module.exports = router;