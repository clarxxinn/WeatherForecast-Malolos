'use strict';

const router = require('express').Router();
const validate = require('../middleware/validate');
const attachLocation = require('../middleware/resolveLocation');
const { historyQuery } = require('../validators');
const { getHistory } = require('../controllers/history.controller');

router.get('/', validate(historyQuery, 'query'), attachLocation, getHistory);

module.exports = router;
