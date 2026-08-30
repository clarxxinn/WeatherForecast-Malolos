'use strict';

/**
 * Location registry. Malolos is the hard-coded default so the app loads without
 * any user input. The structure supports additional locations in the future —
 * add entries here and everything (cache keys, API calls, map) follows.
 */

const LOCATIONS = [
  {
    slug: 'malolos',
    name: 'Malolos',
    region: 'Bulacan',
    country: 'Philippines',
    latitude: 14.8433,
    longitude: 120.8114,
    timezone: 'Asia/Manila',
  },
];

const DEFAULT_SLUG = 'malolos';

/** Return the location for a slug, or the default if the slug is unknown/blank. */
function resolveLocation(slug) {
  if (!slug) return getDefaultLocation();
  const found = LOCATIONS.find((l) => l.slug === String(slug).toLowerCase());
  return found || getDefaultLocation();
}

function getDefaultLocation() {
  return LOCATIONS.find((l) => l.slug === DEFAULT_SLUG);
}

/** Lightweight list for the /api/location endpoint. */
function listLocations() {
  return LOCATIONS.map(({ slug, name, region, country, latitude, longitude }) => ({
    slug,
    name,
    region,
    country,
    latitude,
    longitude,
  }));
}

module.exports = { LOCATIONS, DEFAULT_SLUG, resolveLocation, getDefaultLocation, listLocations };
