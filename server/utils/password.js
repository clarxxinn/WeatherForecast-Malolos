'use strict';

/**
 * Password hashing via bcryptjs (pure-JS, no native build — Windows-friendly).
 * argon2 is documented in the README as a stronger opt-in. Never logs or returns
 * plaintext. Cost factor 12 balances security and login latency.
 */

const bcrypt = require('bcryptjs');

const ROUNDS = 12;

async function hash(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

async function compare(plain, hashed) {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
}

module.exports = { hash, compare };
