'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const { requireDb, requireAuth, requireCsrfHeader } = require('../middleware/auth.middleware');
const { preferencesBody } = require('../validators');
const ctrl = require('../controllers/user.controller');

router.get('/preferences', requireDb, requireAuth, ctrl.getPreferences);
router.put(
  '/preferences',
  requireCsrfHeader,
  requireDb,
  requireAuth,
  validate(preferencesBody, 'body'),
  ctrl.updatePreferences
);

module.exports = router;
