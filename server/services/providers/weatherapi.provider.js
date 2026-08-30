'use strict';

/**
 * WeatherAPI.com adapter. The ONLY module that knows the API key. It fetches a
 * single /forecast.json bundle (current + hourly + alerts + astronomy + AQI) and
 * normalizes it into the app's internal shapes. Upstream errors are mapped to
 * AppError with client-safe messages (never leaking the URL or key).
 */

const { config } = require('../../config');
const { getJson } = require('../../utils/httpClient');
const { fromWeatherApi, round } = require('../normalize');
const { upstream, unavailable } = require('../../utils/httpError');
const logger = require('../../utils/logger');

// Days to request. Free tier typically returns ~3; that is plenty for a rolling
// 24-hour hourly view (we slice what we need after midnight).
const DAYS = 3;

/** Fetch + normalize the full WeatherAPI bundle for a location. */
async function fetchBundle(location) {
  if (!config.weatherApi.enabled) {
    throw unavailable(
      'Live current/hourly data is unavailable because the weather API key is not configured.',
      'WEATHER_API_KEY_MISSING'
    );
  }

  const params = new URLSearchParams({
    key: config.weatherApi.key,
    q: `${location.latitude},${location.longitude}`,
    days: String(DAYS),
    aqi: 'yes',
    alerts: 'yes',
  });
  const url = `${config.weatherApi.base}/forecast.json?${params.toString()}`;

  let raw;
  try {
    raw = await getJson(url, { timeoutMs: 8000, retries: 1 });
  } catch (err) {
    logger.error('WeatherAPI request failed', { status: err.status, name: err.name });
    if (err.status === 401 || err.status === 403) {
      throw unavailable('The configured weather API key was rejected.', 'WEATHER_API_KEY_INVALID');
    }
    if (err.status === 429) {
      throw upstream('Weather service rate limit reached. Please try again shortly.', 'RATE_LIMITED');
    }
    throw upstream('Unable to reach the weather service.', 'UPSTREAM_ERROR');
  }

  return normalizeBundle(raw, location);
}

function normalizeBundle(raw, location) {
  const loc = raw.location || {};
  const current = raw.current || {};
  const forecastDays = raw.forecast?.forecastday || [];

  const normalizedLocation = {
    slug: location.slug,
    name: location.name,
    region: location.region,
    country: location.country,
    lat: location.latitude,
    lon: location.longitude,
    tzId: loc.tz_id || location.timezone,
    localtime: loc.localtime || null,
    localtimeEpoch: loc.localtime_epoch ? loc.localtime_epoch * 1000 : Date.now(),
  };

  const normalizedCurrent = {
    observedAtEpoch: current.last_updated_epoch ? current.last_updated_epoch * 1000 : Date.now(),
    tempC: round(current.temp_c),
    feelsLikeC: round(current.feelslike_c),
    condition: fromWeatherApi(current.condition, current.is_day === 1),
    humidity: current.humidity ?? null,
    cloud: current.cloud ?? null,
    windKph: round(current.wind_kph),
    windDir: current.wind_dir || null,
    windDegree: current.wind_degree ?? null,
    pressureMb: round(current.pressure_mb, 0),
    visKm: round(current.vis_km),
    uv: round(current.uv),
    precipMm: round(current.precip_mm, 1),
    aqi: normalizeAqi(current.air_quality),
  };

  // Flatten hourly across the returned days so callers can slice a rolling 24h.
  const hours = [];
  for (const day of forecastDays) {
    for (const h of day.hour || []) {
      hours.push({
        timeEpoch: h.time_epoch ? h.time_epoch * 1000 : null,
        tempC: round(h.temp_c),
        feelsLikeC: round(h.feelslike_c),
        condition: fromWeatherApi(h.condition, h.is_day === 1),
        chanceOfRain: h.chance_of_rain ?? null,
        precipMm: round(h.precip_mm, 1),
        humidity: h.humidity ?? null,
        windKph: round(h.wind_kph),
        windDir: h.wind_dir || null,
      });
    }
  }

  const astro = forecastDays[0]?.astro || {};
  const normalizedAstro = { sunrise: astro.sunrise || null, sunset: astro.sunset || null };

  const official = (raw.alerts?.alert || []).map(normalizeAlert).filter(Boolean);

  return {
    location: normalizedLocation,
    current: normalizedCurrent,
    hours,
    astro: normalizedAstro,
    official,
  };
}

function normalizeAqi(aq) {
  if (!aq) return null;
  const epa = aq['us-epa-index'];
  const categories = {
    1: 'Good',
    2: 'Moderate',
    3: 'Unhealthy for sensitive groups',
    4: 'Unhealthy',
    5: 'Very unhealthy',
    6: 'Hazardous',
  };
  return {
    usEpaIndex: epa ?? null,
    category: epa ? categories[epa] || 'Unknown' : null,
    pm2_5: round(aq.pm2_5),
    pm10: round(aq.pm10),
  };
}

/** Map a WeatherAPI alert to our shape + 3-tier severity. */
function normalizeAlert(a, i) {
  if (!a) return null;
  const rawSeverity = a.severity || a.urgency || '';
  const s = String(rawSeverity).toLowerCase();
  let severity = 'advisory';
  if (s.includes('extreme') || s.includes('severe')) severity = 'severe';
  else if (s.includes('moderate')) severity = 'warning';

  return {
    id: `official-${i}-${a.effective || ''}`,
    headline: a.headline || a.event || 'Weather alert',
    event: a.event || null,
    severity,
    rawSeverity: rawSeverity || null,
    effectiveEpoch: toEpoch(a.effective),
    expiresEpoch: toEpoch(a.expires),
    areas: a.areas || null,
    desc: a.desc || null,
    instruction: a.instruction || null,
    source: 'weatherapi.com',
  };
}

function toEpoch(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  return Number.isFinite(t) ? t : null;
}

module.exports = { fetchBundle };
