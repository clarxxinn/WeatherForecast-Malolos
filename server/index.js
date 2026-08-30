'use strict';

/**
 * Server entry point. Loads config, prints any non-fatal warnings (missing key /
 * DB), kicks off the async DB probe (never blocks startup), then listens. The
 * app boots fully even with no WEATHER_API_KEY and no DATABASE_URL — Open-Meteo
 * forecast/history + PAGASA links still work.
 */

const { config, reportConfigWarnings } = require('./config');
const { buildApp } = require('./app');
const db = require('./database/pool');
const logger = require('./utils/logger');

reportConfigWarnings(logger);
db.init(); // async connectivity probe; degrades gracefully if unavailable

const app = buildApp();
const server = app.listen(config.port, () => {
  logger.info(`Malolos Weather Monitor listening on http://localhost:${config.port} (${config.env})`);
});

function shutdown(signal) {
  logger.info(`${signal} received — shutting down.`);
  server.close(async () => {
    try {
      await db.close();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
  // Force-exit if connections linger.
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { message: reason?.message || String(reason) });
});

module.exports = server;
