const router = require('express').Router();
const c = require('../controllers/brandController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, permission(PERMISSIONS.BRANDS_READ), c.getAll);
router.post('/', auth, permission(PERMISSIONS.BRANDS_CREATE), c.create);
router.put('/:id', auth, permission(PERMISSIONS.BRANDS_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.BRANDS_DELETE), c.remove);

module.exports = router;