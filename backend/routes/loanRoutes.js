const router = require('express').Router();
const c = require('../controllers/loanController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getAll);
router.get('/stats', auth, c.stats);
router.get('/accounts', auth, c.getAccounts);
router.get('/accounts/:customerId', auth, c.getAccountDetail);
router.get('/:id', auth, c.getOne);
router.put('/:id', auth, permission(PERMISSIONS.LOANS_UPDATE), c.update);
router.delete('/:id', auth, permission(PERMISSIONS.LOANS_UPDATE), c.cancel);
router.patch('/:id/items/:itemId', auth, permission(PERMISSIONS.LOANS_UPDATE), c.updateLoanItem);
router.post('/:id/items/:itemId/pay', auth, permission(PERMISSIONS.LOANS_REPAY), c.payLoanItem);
router.post('/:id/items/:itemId/return', auth, permission(PERMISSIONS.LOANS_UPDATE), c.returnLoanItem);

module.exports = router;