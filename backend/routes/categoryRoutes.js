const router = require('express').Router();
const c = require('../controllers/categoryController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getAll);
router.post('/', auth, permission(PERMISSIONS.CATEGORIES_CREATE), c.create);
router.put('/:id', auth, permission(PERMISSIONS.CATEGORIES_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.CATEGORIES_DELETE), c.remove);

module.exports = router;