'use strict';

/**
 * Forecast-derived advisories. Computes advisory-only notices from REAL forecast
 * values (hourly + daily). Every item is explicitly labeled non-official; these
 * never masquerade as PAGASA warnings. Thresholds live in config/thresholds.js.
 */

const { THRESHOLDS, SEVERITY } = require('../config/thresholds');

const DISCLAIMER = 'Forecast-derived, not an official warning.';

/**
 * @param {object} bundle  WeatherAPI bundle (has hours[])
 * @param {object} daily   Open-Meteo daily result (has days[])
 * @returns {Array} derived advisory objects
 */
function computeDerived(bundle, daily) {
  const derived = [];
  const hours = (bundle?.hours || []).slice(0, THRESHOLDS.lookaheadHours);
  const days = daily?.days || [];

  addRainAdvisories(derived, hours, days);
  addHeatAdvisories(derived, hours);
  addWindAdvisories(derived, days);
  addUvAdvisories(derived, days);

  // Rank severe > warning > advisory for display order.
  const rank = { severe: 0, warning: 1, advisory: 2 };
  derived.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return derived;
}

function addRainAdvisories(out, hours, days) {
  const t = THRESHOLDS.rain;

  // Peak hourly precipitation in the look-ahead window.
  let peak = { precipMm: 0, timeEpoch: null };
  for (const h of hours) {
    if ((h.precipMm ?? 0) > peak.precipMm) peak = { precipMm: h.precipMm, timeEpoch: h.timeEpoch };
  }
  const today = days[0];
  const dailyTotal = today?.precipMm ?? 0;

  if (dailyTotal >= t.dailyExtremeMm || peak.precipMm >= t.hourlyHeavyMm * 4) {
    out.push(make('heavy_rain', SEVERITY.SEVERE, 'Intense rainfall likely',
      `Up to ${peak.precipMm} mm/h forecast; ${dailyTotal} mm expected today.`,
      `Peak hourly precip ${peak.precipMm} mm; daily total ${dailyTotal} mm`, peak.timeEpoch));
  } else if (peak.precipMm >= t.hourlyHeavyMm || dailyTotal >= t.dailyHeavyMm) {
    out.push(make('heavy_rain', SEVERITY.WARNING, 'Heavy rainfall possible',
      `Up to ${peak.precipMm} mm/h forecast; ${dailyTotal} mm expected today.`,
      `Peak hourly precip ${peak.precipMm} mm; daily total ${dailyTotal} mm`, peak.timeEpoch));
  } else if ((today?.chanceOfRain ?? 0) >= t.highChancePct) {
    out.push(make('rain_chance', SEVERITY.ADVISORY, 'High chance of rain',
      `${today.chanceOfRain}% chance of rain today — carry an umbrella.`,
      `Daily chance of rain ${today.chanceOfRain}%`, today.dateEpoch));
  }
}

function addHeatAdvisories(out, hours) {
  const t = THRESHOLDS.heat;
  let peak = { feelsLikeC: -Infinity, timeEpoch: null };
  for (const h of hours) {
    if ((h.feelsLikeC ?? -Infinity) > peak.feelsLikeC) {
      peak = { feelsLikeC: h.feelsLikeC, timeEpoch: h.timeEpoch };
    }
  }
  if (peak.feelsLikeC >= t.dangerC) {
    out.push(make('heat', SEVERITY.WARNING, 'Dangerous heat index',
      `Feels-like temperature may reach ${peak.feelsLikeC}°C. Limit sun exposure and hydrate.`,
      `Peak feels-like ${peak.feelsLikeC}°C`, peak.timeEpoch));
  } else if (peak.feelsLikeC >= t.cautionC) {
    out.push(make('heat', SEVERITY.ADVISORY, 'Elevated heat index',
      `Feels-like temperature may reach ${peak.feelsLikeC}°C. Take breaks from the heat.`,
      `Peak feels-like ${peak.feelsLikeC}°C`, peak.timeEpoch));
  }
}

function addWindAdvisories(out, days) {
  const t = THRESHOLDS.wind;
  const today = days[0];
  const w = today?.maxWindKph ?? 0;
  if (w >= t.severeKph) {
    out.push(make('wind', SEVERITY.SEVERE, 'Damaging winds possible',
      `Winds up to ${w} km/h forecast today.`, `Max wind ${w} km/h`, today?.dateEpoch));
  } else if (w >= t.warningKph) {
    out.push(make('wind', SEVERITY.WARNING, 'Strong winds',
      `Winds up to ${w} km/h forecast today.`, `Max wind ${w} km/h`, today?.dateEpoch));
  } else if (w >= t.advisoryKph) {
    out.push(make('wind', SEVERITY.ADVISORY, 'Breezy to windy',
      `Winds up to ${w} km/h forecast today.`, `Max wind ${w} km/h`, today?.dateEpoch));
  }
}

function addUvAdvisories(out, days) {
  const today = days[0];
  const uv = today?.uv ?? 0;
  if (uv >= THRESHOLDS.uv.veryHigh) {
    out.push(make('uv', SEVERITY.ADVISORY, 'Very high UV index',
      `UV index around ${uv} today. Use sun protection between 10am–4pm.`,
      `Max UV ${uv}`, today?.dateEpoch));
  }
}

function make(type, severity, title, message, basis, atEpoch) {
  return {
    id: `${type}-${severity}-${atEpoch || 'today'}`,
    type,
    severity,
    title,
    message,
    basis,
    atEpoch: atEpoch || null,
    disclaimer: DISCLAIMER,
  };
}

module.exports = { computeDerived, DISCLAIMER };
