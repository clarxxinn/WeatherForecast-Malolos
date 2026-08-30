'use strict';

/** Current conditions. Delegates to the weather service; persists best-effort. */

const { ok } = require('../utils/envelope');
const weatherService = require('../services/weather.service');
const persistence = require('../services/persistence.service');

async function getCurrent(req, res, next) {
  try {
    const data = await weatherService.getCurrent(req.location);
    // Fire-and-forget: never let a DB write delay or fail the response.
    persistence.persistObservation(req.location, data.current);
    return ok(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCurrent };
