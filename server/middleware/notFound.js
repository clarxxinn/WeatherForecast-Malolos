'use strict';

/** 404 for unmatched /api/* routes. Non-API paths are handled by static/SPA. */

const { fail } = require('../utils/envelope');

function notFound(req, res) {
  return fail(res, 404, `Route not found: ${req.method} ${req.path}`, 'NOT_FOUND');
}

module.exports = notFound;
