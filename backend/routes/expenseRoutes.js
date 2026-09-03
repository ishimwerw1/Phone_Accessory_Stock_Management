const router = require('express').Router();
const c = require('../controllers/expenseController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/summary', auth, permission(PERMISSIONS.EXPENSES_READ), c.summary);
router.get('/', auth, permission(PERMISSIONS.EXPENSES_READ), c.getAll);
router.get('/:id', auth, permission(PERMISSIONS.EXPENSES_READ), c.getOne);
router.post('/', auth, permission(PERMISSIONS.EXPENSES_CREATE), c.create);
router.put('/:id', auth, permission(PERMISSIONS.EXPENSES_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.EXPENSES_DELETE), c.remove);

module.exports = router;
