'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const attachLocation = require('../middleware/resolveLocation');
const { hourlyQuery, dailyQuery } = require('../validators');
const { getHourly, getDaily } = require('../controllers/forecast.controller');

router.get('/hourly', validate(hourlyQuery, 'query'), attachLocation, getHourly);
router.get('/daily', validate(dailyQuery, 'query'), attachLocation, getDaily);

module.exports = router;
