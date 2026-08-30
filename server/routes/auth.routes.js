'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { requireDb, requireAuth, requireCsrfHeader } = require('../middleware/auth.middleware');
const { registerBody, loginBody } = require('../validators');
const ctrl = require('../controllers/auth.controller');

// Mutating auth routes: rate-limited, CSRF-header-guarded, DB-required, validated.
router.post('/register', authLimiter, requireCsrfHeader, requireDb, validate(registerBody, 'body'), ctrl.register);
router.post('/login', authLimiter, requireCsrfHeader, requireDb, validate(loginBody, 'body'), ctrl.login);
router.post('/logout', requireCsrfHeader, ctrl.logout);
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
