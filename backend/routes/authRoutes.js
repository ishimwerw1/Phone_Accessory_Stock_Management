const router = require('express').Router();
const c = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login', authLimiter, c.login);
router.post('/logout', auth, c.logout);
router.get('/me', auth, c.me);
router.put('/me', auth, c.updateMe);
router.put('/password', auth, c.changePassword);
router.get('/sessions', auth, c.getSessions);
router.post('/sessions/revoke-others', auth, c.revokeOthers);
router.delete('/sessions/:id', auth, c.revokeSession);

module.exports = router;