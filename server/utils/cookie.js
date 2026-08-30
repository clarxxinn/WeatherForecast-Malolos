'use strict';

/**
 * Auth cookie helpers. The JWT lives in an httpOnly, SameSite=Lax cookie (Secure
 * in production) so it is invisible to page JavaScript — defeating localStorage
 * token theft via XSS. maxAge mirrors the JWT lifetime so the two expire together.
 */

const { config } = require('../config');

function maxAgeMs() {
  const s = String(config.auth.jwtExpiresIn || '2h').trim();
  const m = s.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 2 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return n * mult;
}

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
  };
}

function setAuthCookie(res, jwtToken) {
  res.cookie(config.auth.cookieName, jwtToken, { ...baseOptions(), maxAge: maxAgeMs() });
}

function clearAuthCookie(res) {
  res.clearCookie(config.auth.cookieName, baseOptions());
}

module.exports = { setAuthCookie, clearAuthCookie };
