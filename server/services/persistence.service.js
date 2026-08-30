'use strict';

/**
 * Persistence service. Best-effort writes of real observations/official alerts
 * when the DB is enabled. Every call is guarded and wrapped so a DB failure can
 * NEVER break a weather response — persistence is a side effect, not a dependency.
 */

const db = require('../database/pool');
const locationModel = require('../models/location.model');
const weatherRecordModel = require('../models/weatherRecord.model');
const alertModel = require('../models/alert.model');
const logger = require('../utils/logger');

const crypto = require('crypto');

/** Resolve (and cache within call) the DB location row id for a config location. */
async function locationId(location) {
  const row = await locationModel.ensure({
    name: location.name,
    region: location.region,
    country: location.country,
    latitude: location.latitude,
    longitude: location.longitude,
  });
  return row.id;
}

/** Store a current-conditions snapshot. Fire-and-forget from the caller. */
async function persistObservation(location, current) {
  if (!db.isAvailable() || !current) return;
  try {
    const id = await locationId(location);
    await weatherRecordModel.insert(id, {
      temperature: current.tempC,
      feelsLike: current.feelsLikeC,
      humidity: current.humidity,
      pressure: current.pressureMb,
      windSpeed: current.windKph,
      windDirection: current.windDir,
      rainProbability: current.chanceOfRain ?? null,
      precipitation: current.precipMm,
      visibility: current.visKm,
      uvIndex: current.uv,
      condition: current.condition?.internal,
      // Round to the minute so dedupe works across rapid refreshes.
      recordedAt: Math.floor((current.observedAtEpoch || Date.now()) / 60000) * 60000,
    });
  } catch (err) {
    logger.warn('persistObservation failed (ignored)', { message: err.message });
  }
}

/** Store official alerts (deduped by fingerprint). Derived advisories excluded. */
async function persistOfficialAlerts(location, alerts = []) {
  if (!db.isAvailable() || !alerts.length) return;
  try {
    const id = await locationId(location);
    for (const a of alerts) {
      const fingerprint =
        a.fingerprint ||
        crypto
          .createHash('sha1')
          .update(`${a.title}|${a.issuedEpoch || ''}|${a.source || ''}`)
          .digest('hex');
      // eslint-disable-next-line no-await-in-loop
      await alertModel.insert(id, { ...a, fingerprint });
    }
  } catch (err) {
    logger.warn('persistOfficialAlerts failed (ignored)', { message: err.message });
  }
}

module.exports = { persistObservation, persistOfficialAlerts, locationId };
