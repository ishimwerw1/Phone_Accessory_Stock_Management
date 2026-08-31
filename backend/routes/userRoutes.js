const router = require('express').Router();
const c = require('../controllers/userController');
const { auth, permission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/constants');

router.get('/roles', auth, c.getRoles);
router.get('/', auth, permission(PERMISSIONS.USERS_READ), c.getUsers);
router.post('/', auth, permission(PERMISSIONS.USERS_CREATE), c.createUser);
router.put('/:id', auth, permission(PERMISSIONS.USERS_UPDATE), c.updateUser);
router.delete('/:id', auth, permission(PERMISSIONS.USERS_DELETE), c.deleteUser);

module.exports = router;