'use strict';

/**
 * Consistent JSON response envelope used by every API route:
 *   success -> { success: true, data: {...} }
 *   failure -> { success: false, error: { message, code?, details? } }
 */

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, status, message, code = undefined, details = undefined) {
  const error = { message };
  if (code) error.code = code;
  if (details) error.details = details;
  return res.status(status).json({ success: false, error });
}

module.exports = { ok, fail };
