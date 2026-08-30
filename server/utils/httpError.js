'use strict';

/**
 * Typed application error. Controllers/services throw this to signal an HTTP
 * status + stable error code; the central errorHandler turns it into the JSON
 * envelope. Anything that is NOT an AppError becomes a generic 500.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode  HTTP status (e.g. 400, 404, 502, 503)
   * @param {string} message     Human-readable, client-safe message
   * @param {string} [code]      Stable machine code (e.g. 'UPSTREAM_ERROR')
   * @param {object} [details]   Optional non-sensitive detail (e.g. validation)
   */
  constructor(statusCode, message, code = undefined, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

// Convenience factories for common cases.
const badRequest = (msg, code = 'BAD_REQUEST', details) => new AppError(400, msg, code, details);
const unauthorized = (msg = 'Authentication required.', code = 'UNAUTHORIZED') =>
  new AppError(401, msg, code);
const forbidden = (msg = 'Not allowed.', code = 'FORBIDDEN') => new AppError(403, msg, code);
const notFound = (msg = 'Not found.', code = 'NOT_FOUND') => new AppError(404, msg, code);
const conflict = (msg = 'Already exists.', code = 'CONFLICT') => new AppError(409, msg, code);
const upstream = (msg = 'Weather service is unavailable.', code = 'UPSTREAM_ERROR') =>
  new AppError(502, msg, code);
const unavailable = (msg = 'Service temporarily unavailable.', code = 'UNAVAILABLE') =>
  new AppError(503, msg, code);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, upstream, unavailable };
