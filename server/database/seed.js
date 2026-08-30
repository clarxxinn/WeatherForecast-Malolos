'use strict';

/**
 * Seeds the canonical locations (from server/config/locations.js) into the DB so
 * weather_records / weather_alerts can foreign-key a real row. Run with
 * `npm run db:seed` AFTER `npm run db:migrate`. Idempotent: ON CONFLICT keeps the
 * natural key (name, province, country) unique and refreshes coordinates.
 */

const { config } = require('../config');
const { LOCATIONS } = require('../config/locations');
const logger = require('../utils/logger');

async function main() {
  if (!config.db.enabled) {
    logger.error('DATABASE_URL is not set — nothing to seed. Set it in .env first.');
    process.exit(1);
  }

  // eslint-disable-next-line global-require -- pg is an optional dependency.
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: config.db.url, connectionTimeoutMillis: 8000 });

  try {
    for (const loc of LOCATIONS) {
      // eslint-disable-next-line no-await-in-loop -- tiny, one-time seed list.
      await pool.query(
        `INSERT INTO locations (name, province, country, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name, province, country) DO UPDATE SET
           latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
        [loc.name, loc.region || null, loc.country || null, loc.latitude, loc.longitude]
      );
      logger.info(`Seeded location: ${loc.name}, ${loc.region}`);
    }
    logger.info(`Seed complete — ${LOCATIONS.length} location(s) present.`);
  } catch (err) {
    logger.error('Seed failed.', { message: err.message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
