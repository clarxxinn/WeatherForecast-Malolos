'use strict';

/**
 * User preferences repository. One row per user (UNIQUE user_id). Uses an UPSERT
 * so the first save creates the row and later saves update in place.
 */

const db = require('../database/pool');

const DEFAULTS = {
  temperatureUnit: 'c',
  notificationsEnabled: false,
  defaultLocationId: null,
  theme: 'light',
};

function toShape(row) {
  if (!row) return { ...DEFAULTS };
  return {
    temperatureUnit: row.temperature_unit,
    notificationsEnabled: row.notifications_enabled,
    defaultLocationId: row.default_location_id,
    theme: row.theme,
  };
}

async function getByUserId(userId) {
  const { rows } = await db.query(
    `SELECT temperature_unit, notifications_enabled, default_location_id, theme
     FROM user_preferences WHERE user_id = $1`,
    [userId]
  );
  return toShape(rows[0]);
}

async function upsert(userId, prefs) {
  const merged = { ...DEFAULTS, ...prefs };
  const { rows } = await db.query(
    `INSERT INTO user_preferences (user_id, temperature_unit, notifications_enabled, default_location_id, theme)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       temperature_unit = EXCLUDED.temperature_unit,
       notifications_enabled = EXCLUDED.notifications_enabled,
       default_location_id = EXCLUDED.default_location_id,
       theme = EXCLUDED.theme
     RETURNING temperature_unit, notifications_enabled, default_location_id, theme`,
    [userId, merged.temperatureUnit, merged.notificationsEnabled, merged.defaultLocationId, merged.theme]
  );
  return toShape(rows[0]);
}

module.exports = { getByUserId, upsert, DEFAULTS };
