'use strict';

/** Alerts: official (WeatherAPI) + derived advisories + PAGASA channels. */

const { ok } = require('../utils/envelope');
const alertsService = require('../services/alerts.service');
const persistence = require('../services/persistence.service');

async function getAlerts(req, res, next) {
  try {
    const data = await alertsService.getAlerts(req.location);
    // Persist ONLY official alerts (best-effort). Derived advisories are live-only.
    persistence.persistOfficialAlerts(req.location, data.official);
    return ok(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAlerts };
