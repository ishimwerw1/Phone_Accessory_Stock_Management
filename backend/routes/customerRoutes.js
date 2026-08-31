const router = require('express').Router();
const c = require('../controllers/customerController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getAll);
router.get('/:id', auth, c.getOne);
router.post('/', auth, permission(PERMISSIONS.CUSTOMERS_CREATE), c.create);
router.put('/:id', auth, permission(PERMISSIONS.CUSTOMERS_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.CUSTOMERS_DELETE), c.remove);

module.exports = router;