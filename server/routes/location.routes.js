'use strict';

const router = require('express').Router();
const { getLocation } = require('../controllers/location.controller');

router.get('/', getLocation);

module.exports = router;
