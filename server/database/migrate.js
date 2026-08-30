'use strict';

/**
 * Applies server/database/schema.sql to the configured PostgreSQL database.
 * Run with `npm run db:migrate`. Uses its own short-lived Pool (independent of
 * the app's lazy connectivity probe) and exits non-zero on any failure so it is
 * CI-friendly. The schema is idempotent, so re-running is safe.
 */

const path = require('path');
const fs = require('fs');
const { config } = require('../config');
const logger = require('../utils/logger');

async function main() {
  if (!config.db.enabled) {
    logger.error('DATABASE_URL is not set — nothing to migrate. Set it in .env first.');
    process.exit(1);
  }

  // eslint-disable-next-line global-require -- pg is an optional dependency.
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: config.db.url, connectionTimeoutMillis: 8000 });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    logger.info('Applying schema.sql …');
    await pool.query(sql); // pg runs multiple statements in one non-parameterized query
    logger.info('Migration complete — all tables are present.');
  } catch (err) {
    logger.error('Migration failed.', { message: err.message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
