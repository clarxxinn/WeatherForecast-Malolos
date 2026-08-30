'use strict';

/**
 * User repository. Thin, parameterized pg queries. Never selects the password
 * hash into objects that leave the auth layer (callers pick fields explicitly).
 */

const db = require('../database/pool');

async function create({ name, email, passwordHash }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, token_version, created_at`,
    [name, email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await db.query(
    `SELECT id, name, email, password_hash, token_version
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT id, name, email, token_version, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function emailExists(email) {
  const { rows } = await db.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows.length > 0;
}

async function bumpTokenVersion(id) {
  await db.query('UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = $1', [id]);
}

module.exports = { create, findByEmail, findById, emailExists, bumpTokenVersion };
