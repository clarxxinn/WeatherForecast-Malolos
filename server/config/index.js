'use strict';

/**
 * Central configuration. Reads and validates environment variables once, then
 * exposes a typed, frozen config object to the rest of the server.
 *
 * Design rule: the app must BOOT even when optional pieces (WeatherAPI key,
 * database) are missing — it degrades gracefully instead of crashing.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env from the project root (one level up from /server).
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';

const config = Object.freeze({
  env: NODE_ENV,
  isProd,
  port: toInt(process.env.PORT, 3000),

  weatherApi: {
    key: process.env.WEATHER_API_KEY || '',
    base: process.env.WEATHER_API_BASE || 'https://api.weatherapi.com/v1',
    enabled: Boolean(process.env.WEATHER_API_KEY),
  },

  openMeteo: {
    base: process.env.OPEN_METEO_BASE || 'https://api.open-meteo.com/v1',
    forecastDays: Math.min(Math.max(toInt(process.env.FORECAST_DAYS, 7), 1), 16),
  },

  cache: {
    weatherMinutes: toInt(process.env.WEATHER_CACHE_MINUTES, 10),
    historyMinutes: toInt(process.env.HISTORY_CACHE_MINUTES, 360),
    searchMinutes: toInt(process.env.SEARCH_CACHE_MINUTES, 60),
  },

  db: {
    url: process.env.DATABASE_URL || '',
    enabled: Boolean(process.env.DATABASE_URL),
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
    cookieName: 'mwm_token',
  },

  cors: {
    origins: (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // External official sources surfaced in the UI (links only — never scraped).
  officialSources: [
    { name: 'PAGASA', label: 'PAGASA Official Website', url: 'https://www.pagasa.dost.gov.ph/' },
    { name: 'PAGASA Facebook', label: 'PAGASA on Facebook', url: 'https://www.facebook.com/PAGASA.DOST.GOV.PH' },
  ],
});

/** Emit non-fatal warnings about missing optional configuration at startup. */
function reportConfigWarnings(log) {
  if (!config.weatherApi.enabled) {
    log.warn(
      'WEATHER_API_KEY is not set — current/hourly/alerts will be unavailable ' +
        'until it is provided. The 7-day forecast and history (Open-Meteo) still work.'
    );
  }
  if (config.db.enabled && !config.auth.jwtSecret) {
    log.warn(
      'DATABASE_URL is set but JWT_SECRET is empty — authentication will be ' +
        'disabled until a JWT_SECRET is configured.'
    );
  }
  if (!config.db.enabled) {
    log.info('DATABASE_URL not set — running in app-only mode (no accounts/history persistence).');
  }
}

module.exports = { config, reportConfigWarnings };
