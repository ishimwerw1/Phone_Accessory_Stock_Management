const router = require('express').Router();
const c = require('../controllers/exchangeRateController');
const { auth } = require('../middleware/auth');

router.get('/', auth, c.getRates);

module.exports = router;