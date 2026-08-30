'use strict';

/**
 * Weather observation repository. Persists a normalized current-conditions
 * snapshot when the DB is enabled. UNIQUE(location_id, recorded_at) + ON CONFLICT
 * DO NOTHING makes repeated writes within the same minute harmless.
 */

const db = require('../database/pool');

async function insert(locationId, obs) {
  const { rows } = await db.query(
    `INSERT INTO weather_records
       (location_id, temperature, feels_like, humidity, pressure, wind_speed,
        wind_direction, rain_probability, precipitation, visibility, uv_index,
        weather_condition, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (location_id, recorded_at) DO NOTHING
     RETURNING id`,
    [
      locationId,
      obs.temperature ?? null,
      obs.feelsLike ?? null,
      obs.humidity ?? null,
      obs.pressure ?? null,
      obs.windSpeed ?? null,
      obs.windDirection ?? null,
      obs.rainProbability ?? null,
      obs.precipitation ?? null,
      obs.visibility ?? null,
      obs.uvIndex ?? null,
      obs.condition ?? null,
      obs.recordedAt ? new Date(obs.recordedAt) : new Date(),
    ]
  );
  return rows[0] || null;
}

async function recent(locationId, limit = 100) {
  const { rows } = await db.query(
    `SELECT temperature, feels_like, humidity, pressure, wind_speed, wind_direction,
            rain_probability, precipitation, visibility, uv_index, weather_condition, recorded_at
     FROM weather_records WHERE location_id = $1
     ORDER BY recorded_at DESC LIMIT $2`,
    [locationId, limit]
  );
  return rows;
}

module.exports = { insert, recent };
