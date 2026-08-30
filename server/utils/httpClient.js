'use strict';

/**
 * Thin wrapper around the built-in global fetch (Node 18+) that adds a timeout
 * and a single retry on network/5xx errors. Returns parsed JSON. Throws a
 * generic Error on failure — providers map these into AppError with safe
 * messages (so upstream URLs/keys never leak to clients).
 */

const logger = require('./logger');

/**
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=8000]
 * @param {number} [opts.retries=1]
 * @param {object} [opts.headers]
 * @returns {Promise<any>} parsed JSON body
 */
async function getJson(url, { timeoutMs = 8000, retries = 1, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        // Retry only on 5xx; 4xx is a permanent client/config problem.
        const body = await safeText(res);
        const err = new Error(`Upstream responded ${res.status}`);
        err.status = res.status;
        err.body = body;
        if (res.status >= 500 && attempt < retries) {
          lastErr = err;
          logger.warn('Upstream 5xx, retrying', { status: res.status });
          continue;
        }
        throw err;
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const isAbort = err.name === 'AbortError';
      const is5xx = err.status && err.status >= 500;
      const isNetwork = !err.status; // fetch network failures have no status
      if (attempt < retries && (isAbort || is5xx || isNetwork)) {
        logger.warn('Upstream request failed, retrying', { reason: err.name || 'network' });
        continue;
      }
      break;
    }
  }
  throw lastErr || new Error('Upstream request failed');
}

async function safeText(res) {
  try {
    return (await res.text())?.slice(0, 500);
  } catch {
    return '';
  }
}

module.exports = { getJson };
