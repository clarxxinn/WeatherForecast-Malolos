'use strict';

/**
 * Alerts service. Combines three clearly-separated tiers:
 *   1. official[]         — real alert objects from WeatherAPI (attributed).
 *   2. derived[]          — forecast-derived advisories (labeled non-official).
 *   3. officialChannels[] — always-present links to PAGASA (the authority).
 *
 * It degrades gracefully: if WeatherAPI is unavailable (e.g. no key), it still
 * returns Open-Meteo-derived advisories + the PAGASA links.
 */

const { config } = require('../config');
const weatherService = require('./weather.service');
const advisories = require('./advisories.service');
const { buildMeta } = require('./normalize');
const logger = require('../utils/logger');

async function getAlerts(location) {
  // Official alerts + hourly come from the WeatherAPI bundle (optional).
  let official = [];
  let bundle = { hours: [] };
  try {
    const res = await weatherService.getBundle(location);
    bundle = res.bundle;
    official = res.bundle.official || [];
  } catch (err) {
    logger.warn('Alerts: WeatherAPI bundle unavailable, using Open-Meteo only', {
      code: err.code,
    });
  }

  // Daily forecast (Open-Meteo, no key) powers wind/UV/rain-chance advisories.
  let daily = { days: [] };
  try {
    daily = await weatherService.getDaily(location);
  } catch (err) {
    logger.warn('Alerts: daily forecast unavailable', { code: err.code });
  }

  const derived = advisories.computeDerived(bundle, daily);

  return {
    location: bundle.location || daily.location || locationShape(location),
    meta: buildMeta({ source: 'weatherapi.com + open-meteo.com', ttlSeconds: 600, cached: false }),
    official,
    derived,
    officialChannels: config.officialSources,
    generatedAt: Date.now(),
  };
}

function locationShape(location) {
  return {
    slug: location.slug,
    name: location.name,
    region: location.region,
    country: location.country,
    lat: location.latitude,
    lon: location.longitude,
    tzId: location.timezone,
  };
}

module.exports = { getAlerts };
