'use strict';

/**
 * Rate limiters. A general limiter protects all /api/* routes; a stricter one
 * guards /api/auth/* against credential stuffing. Returns the standard failure
 * envelope so clients get a consistent shape. `trust proxy` (set in app.js for
 * prod) makes the client IP accurate behind a proxy/PaaS.
 */

const rateLimit = require('express-rate-limit');
const { fail } = require('../utils/envelope');

function handler(req, res) {
  return fail(res, 429, 'Too many requests. Please slow down and try again shortly.', 'RATE_LIMITED');
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { apiLimiter, authLimiter };
