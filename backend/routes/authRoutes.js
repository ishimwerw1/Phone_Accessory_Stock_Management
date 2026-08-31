const router = require('express').Router();
const c = require('../controllers/authController');
const { auth, permission } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { PERMISSIONS } = require('../utils/constants');

router.post('/login', authLimiter, c.login);
router.get('/me', auth, c.me);

module.exports = router;