'use strict';

/**
 * Weather orchestrator. Fetches the WeatherAPI bundle ONCE per cache window and
 * projects current/hourly from it; pulls the extended daily forecast from
 * Open-Meteo. Every endpoint that needs current/hourly/alerts shares the single
 * cached bundle, keeping upstream calls to ~1 per location per window.
 */

const { config } = require('../config');
const cache = require('./cache');
const weatherApi = require('./providers/weatherapi.provider');
const openMeteo = require('./providers/openmeteo.provider');
const { buildMeta } = require('./normalize');

const weatherTtl = () => Math.max(config.cache.weatherMinutes, 1) * 60;

/** The shared WeatherAPI bundle (current + hours + astro + official alerts). */
async function getBundle(location) {
  const key = `wapi:bundle:${location.slug}`;
  const { value, hit } = await cache.wrap(key, weatherTtl(), () => weatherApi.fetchBundle(location));
  return { bundle: value, cached: hit };
}

/** Current conditions projection. */
async function getCurrent(location) {
  const { bundle, cached } = await getBundle(location);
  return {
    location: bundle.location,
    meta: buildMeta({ source: 'weatherapi.com', ttlSeconds: weatherTtl(), cached }),
    current: bundle.current,
    astro: bundle.astro,
  };
}

/** Rolling hourly forecast starting at the location's "now". */
async function getHourly(location, hours = 24) {
  const { bundle, cached } = await getBundle(location);
  const now = bundle.location.localtimeEpoch || Date.now();
  // Keep from the current hour onward; cap to `hours`.
  const startOfHour = now - (now % (3600 * 1000));
  const upcoming = bundle.hours
    .filter((h) => h.timeEpoch != null && h.timeEpoch >= startOfHour)
    .slice(0, hours);
  return {
    location: bundle.location,
    meta: buildMeta({ source: 'weatherapi.com', ttlSeconds: weatherTtl(), cached }),
    hours: upcoming,
  };
}

/** Extended daily forecast from Open-Meteo (cached separately). */
async function getDaily(location, days = config.openMeteo.forecastDays) {
  const key = `om:daily:${location.slug}:${days}`;
  const { value, hit } = await cache.wrap(key, weatherTtl(), () => openMeteo.fetchDaily(location, days));
  return {
    location: value.location,
    meta: buildMeta({ source: 'open-meteo.com', ttlSeconds: weatherTtl(), cached: hit }),
    days: value.days,
  };
}

module.exports = { getBundle, getCurrent, getHourly, getDaily };
