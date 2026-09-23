const router = require('express').Router();
const c = require('../controllers/purchaseController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/supplier-debts', auth, permission(PERMISSIONS.PURCHASES_READ), c.supplierDebts);
router.get('/', auth, permission(PERMISSIONS.PURCHASES_READ), c.getAll);
router.get('/suppliers/:supplierId', auth, permission(PERMISSIONS.PURCHASES_READ), c.getSupplierGroup);
router.post('/suppliers/:supplierId/pay-all', auth, permission(PERMISSIONS.PURCHASES_UPDATE), c.payAllSupplier);
router.put('/suppliers/:supplierId/cancel-all', auth, permission(PERMISSIONS.PURCHASES_DELETE), c.cancelSupplierGroup);
router.post('/', auth, permission(PERMISSIONS.PURCHASES_CREATE), c.create);
router.get('/:id', auth, permission(PERMISSIONS.PURCHASES_READ), c.getOne);
router.put('/:id/items/:itemId', auth, permission(PERMISSIONS.PURCHASES_UPDATE), c.editItem);
router.delete('/:id/items/:itemId', auth, permission(PERMISSIONS.PURCHASES_DELETE), c.removeItem);
router.post('/:id/items/:itemId/pay', auth, permission(PERMISSIONS.PURCHASES_UPDATE), c.payItem);
router.post('/:id/items/:itemId/return', auth, permission(PERMISSIONS.PURCHASES_UPDATE), c.returnItem);
router.post('/:id/pay-all', auth, permission(PERMISSIONS.PURCHASES_UPDATE), c.payAll);
router.put('/:id', auth, permission(PERMISSIONS.PURCHASES_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.PURCHASES_DELETE), c.remove);

module.exports = router;