'use strict';

/**
 * Tiny in-memory TTL cache with a single-flight guard so concurrent requests
 * for the same key trigger only ONE upstream call. Per-process only (fine for a
 * single instance; swap for Redis to scale horizontally — see README).
 */

const logger = require('../utils/logger');

const store = new Map(); // key -> { value, expiresAt }
const inflight = new Map(); // key -> Promise (dedupe concurrent loads)
const MAX_ENTRIES = 500;

function now() {
  return Date.now();
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value, ttlSeconds) {
  if (store.size >= MAX_ENTRIES) {
    // Drop the oldest inserted entry (Map preserves insertion order).
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
}

/**
 * Return the cached value for `key`, or run `loader()` once, cache it, and
 * return it. Concurrent callers share one in-flight promise.
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<any>} loader
 */
async function wrap(key, ttlSeconds, loader) {
  const cached = get(key);
  if (cached !== undefined) {
    return { value: cached, hit: true };
  }
  if (inflight.has(key)) {
    return { value: await inflight.get(key), hit: true };
  }
  const promise = (async () => {
    const value = await loader();
    set(key, value, ttlSeconds);
    return value;
  })();
  inflight.set(key, promise);
  try {
    const value = await promise;
    return { value, hit: false };
  } finally {
    inflight.delete(key);
  }
}

function stats() {
  return { size: store.size, inflight: inflight.size };
}

function clear() {
  store.clear();
  inflight.clear();
  logger.debug('Cache cleared');
}

module.exports = { get, set, wrap, stats, clear };
