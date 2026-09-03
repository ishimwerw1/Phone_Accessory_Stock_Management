const router = require('express').Router();
const c = require('../controllers/purchaseController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/supplier-debts', auth, permission(PERMISSIONS.PURCHASES_READ), c.supplierDebts);
router.get('/', auth, permission(PERMISSIONS.PURCHASES_READ), c.getAll);
router.get('/:id', auth, permission(PERMISSIONS.PURCHASES_READ), c.getOne);
router.post('/', auth, permission(PERMISSIONS.PURCHASES_CREATE), c.create);
router.put('/:id', auth, permission(PERMISSIONS.PURCHASES_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.PURCHASES_DELETE), c.remove);

module.exports = router;
