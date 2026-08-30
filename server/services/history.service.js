'use strict';

/**
 * History service. Serves recent observations from Open-Meteo (no key, avoids the
 * archive API's ~5-day lag by using past_days). When the optional database is
 * enabled it can be extended to prefer stored observations; today it always has
 * a working provider-backed source so the History page is never empty.
 */

const { config } = require('../config');
const cache = require('./cache');
const openMeteo = require('./providers/openmeteo.provider');
const { buildMeta } = require('./normalize');

const VALID_RANGES = new Set(['24h', '7d', '30d']);
const historyTtl = () => Math.max(config.cache.historyMinutes, 1) * 60;

async function getHistory(location, range = '24h') {
  const normalizedRange = VALID_RANGES.has(range) ? range : '24h';
  const key = `om:hist:${location.slug}:${normalizedRange}`;
  const { value, hit } = await cache.wrap(key, historyTtl(), () =>
    openMeteo.fetchHistory(location, normalizedRange)
  );
  return {
    location: value.location,
    meta: buildMeta({ source: 'open-meteo.com', ttlSeconds: historyTtl(), cached: hit }),
    range: value.range,
    granularity: value.granularity,
    source: 'open-meteo',
    points: value.points,
  };
}

module.exports = { getHistory, VALID_RANGES };
