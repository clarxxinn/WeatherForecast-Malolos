'use strict';

/**
 * Minimal logger. Intentionally tiny (no dependency) and careful never to print
 * secrets. Levels are gated so debug noise stays out of production.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug;

// Keys whose values must never be logged.
const REDACT = /(key|secret|password|token|authorization|cookie|database_url)/i;

function scrub(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    // Redact `key=...` style query params.
    return value.replace(/([?&])(api[_-]?key|key)=([^&\s]+)/gi, '$1$2=***');
  }
  if (typeof value === 'object') {
    const out = Array.isArray(value) ? [] : {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT.test(k) ? '***' : scrub(v);
    }
    return out;
  }
  return value;
}

function emit(level, args) {
  if (LEVELS[level] > activeLevel) return;
  const ts = new Date().toISOString();
  const cleaned = args.map(scrub);
  // eslint-disable-next-line no-console
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(`[${ts}] [${level.toUpperCase()}]`, ...cleaned);
}

module.exports = {
  error: (...a) => emit('error', a),
  warn: (...a) => emit('warn', a),
  info: (...a) => emit('info', a),
  debug: (...a) => emit('debug', a),
};
