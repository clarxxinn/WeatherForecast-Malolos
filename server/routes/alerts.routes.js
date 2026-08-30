'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const attachLocation = require('../middleware/resolveLocation');
const { locationQuery } = require('../validators');
const { getAlerts } = require('../controllers/alerts.controller');

router.get('/', validate(locationQuery, 'query'), attachLocation, getAlerts);

module.exports = router;
