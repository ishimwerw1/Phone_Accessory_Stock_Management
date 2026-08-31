const router = require('express').Router();
const c = require('../controllers/paymentController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/', auth, c.getAll);
router.post('/loans/:loanId/repay', auth, permission(PERMISSIONS.LOANS_REPAY), c.repayLoan);

module.exports = router;