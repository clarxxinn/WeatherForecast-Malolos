/**
 * App-wide constants. Everything the client needs to know that isn't fetched.
 * The frontend only ever talks to our own /api — never to WeatherAPI/Open-Meteo
 * directly — so no keys or upstream URLs live here.
 */

export const CONFIG = Object.freeze({
  apiBase: '/api',
  timeZone: 'Asia/Manila',
  // Auto-refresh cadence for live data. Matches the server cache window so a
  // refresh usually lands on a fresh upstream pull rather than a cache echo.
  refreshMs: 10 * 60 * 1000,
  clockTickMs: 1000,
  defaultLocationSlug: 'malolos',
  pagasaUrl: 'https://www.pagasa.dost.gov.ph/',
});

// The single condition vocabulary the server normalizes every provider into.
// Keep in sync with server/services/normalize.js CONDITION.
export const CONDITIONS = Object.freeze([
  'clear',
  'partly-cloudy',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'heavy-rain',
  'thunderstorm',
  'snow',
  'sleet',
  'unknown',
]);
