'use strict';

/**
 * Open-Meteo adapter (no API key). Supplies the extended 7-day DAILY forecast
 * and HISTORICAL data — the pieces WeatherAPI's free tier does not fully cover.
 * Uses timeformat=unixtime so every timestamp is a reliable UTC epoch that the
 * frontend formats in Asia/Manila.
 */

const { config } = require('../../config');
const { getJson } = require('../../utils/httpClient');
const { fromWmo, round } = require('../normalize');
const { upstream } = require('../../utils/httpError');
const logger = require('../../utils/logger');

const TZ = 'Asia/Manila';

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: TZ });

function labelFor(epochMs) {
  const d = new Date(epochMs);
  return { dayName: dayFmt.format(d), dateLabel: dateFmt.format(d) };
}

async function request(pathAndQuery) {
  const url = `${config.openMeteo.base}${pathAndQuery}`;
  try {
    return await getJson(url, { timeoutMs: 8000, retries: 1 });
  } catch (err) {
    logger.error('Open-Meteo request failed', { status: err.status, name: err.name });
    throw upstream('Unable to reach the forecast/history service.', 'UPSTREAM_ERROR');
  }
}

/** Extended 7-day daily forecast. */
async function fetchDaily(location, days = config.openMeteo.forecastDays) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,' +
      'precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset',
    timezone: TZ,
    timeformat: 'unixtime',
    forecast_days: String(days),
  });
  const raw = await request(`/forecast?${params.toString()}`);
  const d = raw.daily || {};
  const times = d.time || [];

  const out = times.map((t, i) => {
    const dateEpoch = t * 1000;
    const { dayName, dateLabel } = labelFor(dateEpoch);
    return {
      dateEpoch,
      dayName,
      dateLabel,
      condition: fromWmo(d.weather_code?.[i], true),
      maxC: round(d.temperature_2m_max?.[i]),
      minC: round(d.temperature_2m_min?.[i]),
      chanceOfRain: d.precipitation_probability_max?.[i] ?? null,
      precipMm: round(d.precipitation_sum?.[i], 1),
      maxWindKph: round(d.wind_speed_10m_max?.[i]),
      uv: round(d.uv_index_max?.[i]),
      sunriseEpoch: d.sunrise?.[i] ? d.sunrise[i] * 1000 : null,
      sunsetEpoch: d.sunset?.[i] ? d.sunset[i] * 1000 : null,
    };
  });

  return { location: locationShape(location), days: out };
}

/**
 * Historical data via the forecast API's past_days (avoids the ~5-day lag of the
 * archive API). 24h -> hourly points; 7d/30d -> daily aggregates.
 */
async function fetchHistory(location, range = '24h') {
  if (range === '24h') return fetchHistoryHourly(location);
  const days = range === '30d' ? 30 : 7;
  return fetchHistoryDaily(location, days);
}

async function fetchHistoryHourly(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',
    timezone: TZ,
    timeformat: 'unixtime',
    past_days: '2',
    forecast_days: '1',
  });
  const raw = await request(`/forecast?${params.toString()}`);
  const h = raw.hourly || {};
  const times = h.time || [];
  const nowSec = Math.floor(Date.now() / 1000);
  const cutoff = nowSec - 24 * 3600;

  const points = [];
  times.forEach((t, i) => {
    if (t < cutoff || t > nowSec) return; // keep the last 24 hours only
    points.push({
      timeEpoch: t * 1000,
      tempC: round(h.temperature_2m?.[i]),
      humidity: h.relative_humidity_2m?.[i] ?? null,
      precipMm: round(h.precipitation?.[i], 1),
      windKph: round(h.wind_speed_10m?.[i]),
    });
  });

  return { location: locationShape(location), range: '24h', granularity: 'hourly', points };
}

async function fetchHistoryDaily(location, days) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,weather_code',
    timezone: TZ,
    timeformat: 'unixtime',
    past_days: String(days),
    forecast_days: '1',
  });
  const raw = await request(`/forecast?${params.toString()}`);
  const d = raw.daily || {};
  const times = d.time || [];
  const nowSec = Math.floor(Date.now() / 1000);

  const points = [];
  times.forEach((t, i) => {
    if (t > nowSec) return; // exclude the future "today+" bucket edge
    const dateEpoch = t * 1000;
    const { dayName, dateLabel } = labelFor(dateEpoch);
    points.push({
      timeEpoch: dateEpoch,
      dayName,
      dateLabel,
      tempMaxC: round(d.temperature_2m_max?.[i]),
      tempMinC: round(d.temperature_2m_min?.[i]),
      tempAvgC: round(d.temperature_2m_mean?.[i]),
      precipMm: round(d.precipitation_sum?.[i], 1),
      condition: fromWmo(d.weather_code?.[i], true),
    });
  });

  return { location: locationShape(location), range: `${days}d`, granularity: 'daily', points };
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

module.exports = { fetchDaily, fetchHistory };
