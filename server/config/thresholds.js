'use strict';

/**
 * Thresholds for FORECAST-DERIVED advisories.
 *
 * IMPORTANT: These are NOT official warnings. They are computed from real
 * forecast values (WeatherAPI/Open-Meteo) and are always surfaced to the user
 * with a clear "forecast-derived, not an official warning" disclaimer. Official
 * warnings come only from PAGASA (linked) or a provider's own alerts feed.
 *
 * Reference points loosely follow PAGASA rainfall/heat-index guidance so the
 * advisories are meaningful, but they remain advisory-only. Tune here.
 */

const SEVERITY = Object.freeze({ ADVISORY: 'advisory', WARNING: 'warning', SEVERE: 'severe' });

const THRESHOLDS = Object.freeze({
  rain: {
    // Per-hour precipitation (mm) within the look-ahead window.
    hourlyHeavyMm: 7.5, // -> warning
    // Total precipitation across a forecast day (mm).
    dailyHeavyMm: 50, // -> warning
    dailyExtremeMm: 100, // -> severe
    // Chance of rain (%) on a day.
    highChancePct: 80, // -> advisory
  },
  heat: {
    // "Feels like" / heat index (°C).
    cautionC: 33, // -> advisory (extreme caution)
    dangerC: 41, // -> warning (danger)
  },
  wind: {
    // Sustained/max wind (km/h).
    advisoryKph: 40, // strong winds
    warningKph: 62, // gale / TS-force
    severeKph: 89, // damaging winds
  },
  uv: {
    veryHigh: 8, // -> advisory
  },
  // How many hours ahead to scan the hourly forecast for advisories.
  lookaheadHours: 24,
});

module.exports = { SEVERITY, THRESHOLDS };
