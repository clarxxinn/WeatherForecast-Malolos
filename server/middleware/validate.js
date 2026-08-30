'use strict';

/**
 * Zod validation middleware. `validate(schema, source)` parses req[source]
 * ('query' | 'body' | 'params'), replaces it with the coerced/validated value,
 * and returns a 400 with field details on failure. Keeps controllers clean.
 */

const { badRequest } = require('../utils/httpError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] || {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || source,
        message: i.message,
      }));
      return next(badRequest('Invalid request.', 'VALIDATION', details));
    }
    // Query/params objects are read-only getters on newer Express — assign to a
    // parallel field the controllers read instead of mutating req.query.
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;
    return next();
  };
}

module.exports = validate;
