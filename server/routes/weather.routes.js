'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const attachLocation = require('../middleware/resolveLocation');
const { locationQuery } = require('../validators');
const { getCurrent } = require('../controllers/weather.controller');

router.get('/', validate(locationQuery, 'query'), attachLocation, getCurrent);

module.exports = router;
