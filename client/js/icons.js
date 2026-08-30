/**
 * Maps the server's normalized condition enum (+ isDay) to a Lucide icon name
 * and a "living sky" background class. The frontend depends only on this enum,
 * never on raw WeatherAPI/WMO codes — so swapping providers changes nothing here.
 */

// enum -> Lucide icon. Day/night pairs where the sky itself differs.
const ICON = {
  clear: { day: 'sun', night: 'moon' },
  'partly-cloudy': { day: 'cloud-sun', night: 'cloud-moon' },
  cloudy: 'cloud',
  fog: 'cloud-fog',
  drizzle: 'cloud-drizzle',
  rain: 'cloud-rain',
  'heavy-rain': 'cloud-rain-wind',
  thunderstorm: 'cloud-lightning',
  snow: 'snowflake',
  sleet: 'cloud-hail',
  unknown: 'cloud-off',
};

// enum -> weather-bg.css sky theme suffix (see .sky--* classes).
const SKY = {
  clear: { day: 'clear-day', night: 'clear-night' },
  'partly-cloudy': { day: 'partly-day', night: 'partly-night' },
  cloudy: 'cloudy',
  fog: 'fog',
  drizzle: 'rain',
  rain: 'rain',
  'heavy-rain': 'heavy-rain',
  thunderstorm: 'storm',
  snow: 'snow',
  sleet: 'rain',
  unknown: 'cloudy',
};

const pick = (table, condition) => {
  const internal = condition?.internal || 'unknown';
  const isDay = condition?.isDay !== false;
  const entry = table[internal] || table.unknown;
  return typeof entry === 'string' ? entry : isDay ? entry.day : entry.night;
};

export const iconFor = (condition) => pick(ICON, condition);
export const skyClassFor = (condition) => `sky--${pick(SKY, condition)}`;
export const conditionText = (condition) => condition?.text || 'Unknown';

/** True for the wet conditions that get animated precipitation in the hero. */
export const isWet = (condition) =>
  ['drizzle', 'rain', 'heavy-rain', 'thunderstorm', 'sleet'].includes(condition?.internal);
