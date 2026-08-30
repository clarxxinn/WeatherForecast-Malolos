'use strict';

/**
 * Optional PostgreSQL access. The app runs fully without a database. A Pool is
 * created only when DATABASE_URL is set; an async probe decides availability
 * WITHOUT ever blocking server startup. On a query failure we flip to
 * unavailable and re-probe with backoff so a recovered DB is picked up
 * automatically. `pg` is required lazily so the dependency is optional.
 */

const { config } = require('../config');
const logger = require('../utils/logger');
const { unavailable } = require('../utils/httpError');

let pool = null;
let available = false;
let probing = false;
let backoffMs = 2000;

function init() {
  if (!config.db.enabled) {
    logger.info('Database disabled (no DATABASE_URL).');
    return;
  }
  try {
    // Lazy require: keeps `pg` optional when the DB is not used.
    // eslint-disable-next-line global-require
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: config.db.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      logger.error('Postgres pool error', { message: err.message });
      available = false;
      scheduleProbe();
    });
    probe();
  } catch (err) {
    logger.error('Failed to initialize pg (is it installed?)', { message: err.message });
    pool = null;
  }
}

async function probe() {
  if (!pool || probing) return;
  probing = true;
  try {
    await pool.query('SELECT 1');
    if (!available) logger.info('Database connection established.');
    available = true;
    backoffMs = 2000;
  } catch (err) {
    available = false;
    logger.warn('Database probe failed; will retry.', { message: err.message });
    scheduleProbe();
  } finally {
    probing = false;
  }
}

function scheduleProbe() {
  if (!pool) return;
  const delay = backoffMs;
  backoffMs = Math.min(backoffMs * 2, 60000);
  setTimeout(probe, delay).unref?.();
}

/** True only when the DB is configured AND currently reachable. */
function isAvailable() {
  return Boolean(pool) && available;
}

/** Configured at all (even if momentarily unreachable). */
function isConfigured() {
  return Boolean(config.db.enabled);
}

/** Parameterized query. Throws 503 when the DB is unavailable. */
async function query(text, params = []) {
  if (!isAvailable()) {
    throw unavailable('The database is currently unavailable.', 'DB_DISABLED');
  }
  try {
    return await pool.query(text, params);
  } catch (err) {
    // A failed query may indicate the connection dropped — re-probe.
    available = false;
    scheduleProbe();
    throw err;
  }
}

function status() {
  if (!isConfigured()) return 'disabled';
  return available ? 'up' : 'down';
}

async function close() {
  if (pool) await pool.end();
}

module.exports = { init, query, isAvailable, isConfigured, status, close };
