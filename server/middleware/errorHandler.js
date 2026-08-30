'use strict';

/**
 * Central error handler. Converts any thrown value into the standard failure
 * envelope. Operational AppErrors surface their message/code; unexpected errors
 * are logged with a stack and returned as a generic 500 (never leak internals).
 */

const { AppError } = require('../utils/httpError');
const { fail } = require('../utils/envelope');
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature.
function errorHandler(err, req, res, next) {
  if (err instanceof AppError && err.isOperational) {
    if (err.statusCode >= 500) {
      logger.error('Operational error', { code: err.code, message: err.message });
    }
    return fail(res, err.statusCode, err.message, err.code, err.details);
  }

  // Body-parser JSON syntax errors arrive as SyntaxError with a status.
  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 400, 'Malformed JSON in request body.', 'BAD_JSON');
  }

  logger.error('Unhandled error', { message: err?.message, stack: err?.stack });
  return fail(res, 500, 'An unexpected error occurred.', 'INTERNAL');
}

module.exports = errorHandler;
