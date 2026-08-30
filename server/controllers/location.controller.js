'use strict';

/** Location metadata. Exposes the default (Malolos) + the list, public fields only. */

const { ok } = require('../utils/envelope');
const { listLocations, getDefaultLocation } = require('../config/locations');

function publicShape(loc) {
  return {
    slug: loc.slug,
    name: loc.name,
    region: loc.region,
    country: loc.country,
    lat: loc.latitude,
    lon: loc.longitude,
    tzId: loc.timezone,
  };
}

function getLocation(req, res) {
  return ok(res, {
    default: publicShape(getDefaultLocation()),
    locations: listLocations().map(publicShape),
  });
}

module.exports = { getLocation };
