'use strict';

/** Health/status endpoint. Cheap, dependency-light, safe to expose. */

const { ok } = require('../utils/envelope');
const cache = require('../services/cache');
const db = require('../database/pool');
const { config } = require('../config');

const manilaFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'medium',
});

function health(req, res) {
  return ok(res, {
    status: 'ok',
    env: config.env,
    db: db.status(), // 'disabled' | 'up' | 'down'
    weatherApi: config.weatherApi.enabled ? 'configured' : 'disabled',
    cache: cache.stats(),
    serverTime: new Date().toISOString(),
    localTime: manilaFmt.format(new Date()),
  });
}

module.exports = { health };
