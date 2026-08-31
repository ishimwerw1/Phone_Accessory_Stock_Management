const router = require('express').Router();
const c = require('../controllers/productController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, permission(PERMISSIONS.PRODUCTS_READ), c.getAll);
router.get('/autocomplete', auth, permission(PERMISSIONS.PRODUCTS_READ), c.getAutocomplete);
router.get('/:id', auth, permission(PERMISSIONS.PRODUCTS_READ), c.getOne);
router.post('/', auth, permission(PERMISSIONS.PRODUCTS_CREATE), c.create);
router.put('/:id', auth, permission(PERMISSIONS.PRODUCTS_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.PRODUCTS_DELETE), c.remove);

module.exports = router;