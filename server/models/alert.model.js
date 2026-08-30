'use strict';

/**
 * Alert repository. Persists OFFICIAL alerts only (from WeatherAPI). A stable
 * `fingerprint` (UNIQUE) dedupes repeat ingestions of the same alert. Derived
 * advisories are computed live and never stored as if official.
 */

const db = require('../database/pool');

async function insert(locationId, alert) {
  const { rows } = await db.query(
    `INSERT INTO weather_alerts
       (location_id, title, description, severity, source, issued_at, expires_at, fingerprint)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (fingerprint) DO NOTHING
     RETURNING id`,
    [
      locationId,
      alert.title || 'Weather alert',
      alert.description || null,
      alert.severity || null,
      alert.source || null,
      alert.issuedEpoch ? new Date(alert.issuedEpoch) : null,
      alert.expiresEpoch ? new Date(alert.expiresEpoch) : null,
      alert.fingerprint,
    ]
  );
  return rows[0] || null;
}

module.exports = { insert };
