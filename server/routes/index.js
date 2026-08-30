'use strict';

/** Aggregates all API sub-routers under /api (mounted in app.js). */

const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/location', require('./location.routes'));
router.use('/weather', require('./weather.routes'));
router.use('/forecast', require('./forecast.routes'));
router.use('/alerts', require('./alerts.routes'));
router.use('/history', require('./history.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/user', require('./user.routes'));

module.exports = router;
