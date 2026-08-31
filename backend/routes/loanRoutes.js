const router = require('express').Router();
const c = require('../controllers/loanController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getAll);
router.get('/stats', auth, c.stats);
router.get('/:id', auth, c.getOne);
router.put('/:id', auth, permission(PERMISSIONS.LOANS_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.LOANS_UPDATE), c.cancel);

module.exports = router;