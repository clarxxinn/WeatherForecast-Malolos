'use strict';

/**
 * Auth controller. Register/login/logout/me. Requires the DB (guarded by
 * middleware). Passwords are bcrypt-hashed and NEVER logged or returned. Login
 * failures are deliberately generic (no "user not found" oracle). The JWT carries
 * token_version so sessions can be revoked server-side.
 */

const { ok } = require('../utils/envelope');
const { conflict, unauthorized } = require('../utils/httpError');
const userModel = require('../models/user.model');
const preferencesModel = require('../models/preferences.model');
const password = require('../utils/password');
const token = require('../utils/token');
const { setAuthCookie, clearAuthCookie } = require('../utils/cookie');

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email };
}

function issueSession(res, user) {
  const jwt = token.sign({ sub: user.id, tv: user.token_version ?? 0 });
  setAuthCookie(res, jwt);
}

async function register(req, res, next) {
  try {
    const { name, email, password: plain } = req.body;
    if (await userModel.emailExists(email)) {
      return next(conflict('An account with that email already exists.', 'EMAIL_TAKEN'));
    }
    const passwordHash = await password.hash(plain);
    const user = await userModel.create({ name, email, passwordHash });
    // Seed a default preferences row (best-effort; ignore if it races).
    try {
      await preferencesModel.upsert(user.id, {});
    } catch {
      /* non-fatal */
    }
    issueSession(res, user);
    return ok(res, { user: publicUser(user) }, 201);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password: plain } = req.body;
    const user = await userModel.findByEmail(email);
    const valid = user && (await password.compare(plain, user.password_hash));
    if (!valid) {
      return next(unauthorized('Invalid email or password.', 'BAD_CREDENTIALS'));
    }
    issueSession(res, user);
    return ok(res, { user: publicUser(user) });
  } catch (err) {
    return next(err);
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  return ok(res, { loggedOut: true });
}

function me(req, res) {
  return ok(res, { user: req.user });
}

module.exports = { register, login, logout, me };
