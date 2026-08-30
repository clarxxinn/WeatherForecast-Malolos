'use strict';

/**
 * JWT helpers. Tokens are signed with JWT_SECRET and carry the user id plus a
 * token_version, so bumping a user's version (e.g. on password change) instantly
 * invalidates old tokens. Signing throws if no secret is configured.
 */

const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { unauthorized } = require('./httpError');

function sign(payload) {
  if (!config.auth.jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
  });
}

function verify(token) {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (err) {
    throw unauthorized('Invalid or expired session.', 'BAD_TOKEN');
  }
}

module.exports = { sign, verify };
