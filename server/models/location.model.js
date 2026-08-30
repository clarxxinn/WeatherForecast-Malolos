'use strict';

/**
 * Location repository. The app's canonical locations live in config; this mirrors
 * them into the DB (when enabled) so weather_records/alerts can foreign-key a row.
 * `ensure` is idempotent on (name, province, country).
 */

const db = require('../database/pool');

async function ensure(loc) {
  const { rows } = await db.query(
    `INSERT INTO locations (name, province, country, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (name, province, country) DO UPDATE SET
       latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
     RETURNING id, name, province, country, latitude, longitude`,
    [loc.name, loc.region || null, loc.country || null, loc.latitude, loc.longitude]
  );
  return rows[0];
}

async function findByName(name, province, country) {
  const { rows } = await db.query(
    `SELECT id, name, province, country, latitude, longitude
     FROM locations WHERE name = $1 AND province IS NOT DISTINCT FROM $2 AND country IS NOT DISTINCT FROM $3`,
    [name, province || null, country || null]
  );
  return rows[0] || null;
}

module.exports = { ensure, findByName };
