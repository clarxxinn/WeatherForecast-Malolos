'use strict';

/**
 * Resolves the target location from a validated `?location=<slug>` query param,
 * defaulting to Malolos. An explicitly-provided but unknown slug is a 404 (rather
 * than silently serving the wrong place). Attaches the location as req.location.
 */

const { resolveLocation, getDefaultLocation } = require('../config/locations');
const { notFound } = require('../utils/httpError');

function attachLocation(req, res, next) {
  const slug = (req.validatedQuery?.location || '').trim();
  if (!slug) {
    req.location = getDefaultLocation();
    return next();
  }
  const loc = resolveLocation(slug);
  if (!loc) {
    return next(notFound(`Unknown location: ${slug}`, 'UNKNOWN_LOCATION'));
  }
  req.location = loc;
  return next();
}

module.exports = attachLocation;
