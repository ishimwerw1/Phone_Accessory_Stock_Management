const router = require('express').Router();
const c = require('../controllers/reportController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/dashboard', auth, c.dashboard);
router.get('/sales', auth, permission(PERMISSIONS.REPORTS_READ), c.salesReport);
router.get('/stock', auth, permission(PERMISSIONS.REPORTS_READ), c.stockReport);
router.get('/products', auth, permission(PERMISSIONS.REPORTS_READ), c.productReport);
router.get('/customers', auth, permission(PERMISSIONS.REPORTS_READ), c.customerReport);
router.get('/loans', auth, permission(PERMISSIONS.REPORTS_READ), c.loanReport);
router.get('/financial', auth, permission(PERMISSIONS.REPORTS_READ), c.financialReport);
router.get('/expenses', auth, permission(PERMISSIONS.REPORTS_READ), c.expenseReport);
router.get('/purchases', auth, permission(PERMISSIONS.REPORTS_READ), c.purchaseReport);
router.get('/user-performance', auth, permission(PERMISSIONS.REPORTS_READ), c.userPerformanceReport);

module.exports = router;