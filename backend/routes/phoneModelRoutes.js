const router = require('express').Router();
const c = require('../controllers/phoneModelController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getAll);
router.get('/by-brand', auth, c.listByBrand);
router.post('/', auth, permission(PERMISSIONS.PHONEMODELS_CREATE), c.create);
router.put('/:id', auth, permission(PERMISSIONS.PHONEMODELS_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.PHONEMODELS_DELETE), c.remove);

module.exports = router;