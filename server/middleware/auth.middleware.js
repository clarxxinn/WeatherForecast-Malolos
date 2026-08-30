'use strict';

/**
 * Auth middleware.
 *   - requireDb:   503 when the optional database is not available.
 *   - requireAuth: verifies the JWT cookie, loads the user, checks token_version
 *                  (so bumping it revokes old sessions), sets req.user, else 401.
 *   - optionalAuth: attaches req.user when a valid cookie is present; never fails.
 *   - requireCsrfHeader: defense-in-depth — mutating requests must send
 *                  X-Requested-With (same-origin fetch can, cross-site forms can't).
 */

const { config } = require('../config');
const db = require('../database/pool');
const token = require('../utils/token');
const userModel = require('../models/user.model');
const { unauthorized, unavailable, forbidden } = require('../utils/httpError');

function requireDb(req, res, next) {
  if (!db.isAvailable()) {
    return next(unavailable('This feature requires a database, which is not available.', 'DB_DISABLED'));
  }
  return next();
}

async function loadUser(req) {
  const raw = req.cookies?.[config.auth.cookieName];
  if (!raw) return null;
  const payload = token.verify(raw); // throws AppError(401) on bad/expired
  const user = await userModel.findById(payload.sub);
  if (!user) throw unauthorized('Session user no longer exists.', 'NO_USER');
  if (Number(payload.tv) !== Number(user.token_version)) {
    throw unauthorized('Session has been revoked. Please sign in again.', 'REVOKED');
  }
  return { id: user.id, name: user.name, email: user.email };
}

async function requireAuth(req, res, next) {
  try {
    if (!db.isAvailable()) {
      return next(unavailable('Authentication requires a database, which is not available.', 'DB_DISABLED'));
    }
    const user = await loadUser(req);
    if (!user) return next(unauthorized('Authentication required.', 'NO_SESSION'));
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    if (db.isAvailable()) req.user = await loadUser(req);
  } catch {
    req.user = null; // ignore bad tokens on optional paths
  }
  return next();
}

function requireCsrfHeader(req, res, next) {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(forbidden('Missing required request header.', 'CSRF'));
  }
  return next();
}

module.exports = { requireDb, requireAuth, optionalAuth, requireCsrfHeader };
