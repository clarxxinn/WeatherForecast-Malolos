'use strict';

/**
 * Shared normalization primitives. Both providers map their own condition codes
 * (WeatherAPI numeric codes and Open-Meteo WMO codes) into ONE internal enum so
 * the frontend never depends on a specific provider. The frontend maps the enum
 * (+ isDay) to a Lucide icon and a background class.
 */

// Internal condition enum — the single vocabulary the whole app speaks.
const CONDITION = Object.freeze({
  CLEAR: 'clear',
  PARTLY_CLOUDY: 'partly-cloudy',
  CLOUDY: 'cloudy',
  FOG: 'fog',
  DRIZZLE: 'drizzle',
  RAIN: 'rain',
  HEAVY_RAIN: 'heavy-rain',
  THUNDERSTORM: 'thunderstorm',
  SNOW: 'snow',
  SLEET: 'sleet',
  UNKNOWN: 'unknown',
});

// Human-readable fallback labels (used when a provider gives no text, e.g. Open-Meteo).
const CONDITION_LABEL = Object.freeze({
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  'heavy-rain': 'Heavy rain',
  thunderstorm: 'Thunderstorm',
  snow: 'Snow',
  sleet: 'Sleet',
  unknown: 'Unknown',
});

// WeatherAPI condition.code -> internal enum.
const WEATHERAPI_MAP = {
  1000: CONDITION.CLEAR,
  1003: CONDITION.PARTLY_CLOUDY,
  1006: CONDITION.CLOUDY,
  1009: CONDITION.CLOUDY,
  1030: CONDITION.FOG,
  1135: CONDITION.FOG,
  1147: CONDITION.FOG,
  1063: CONDITION.RAIN,
  1150: CONDITION.DRIZZLE,
  1153: CONDITION.DRIZZLE,
  1168: CONDITION.DRIZZLE,
  1171: CONDITION.DRIZZLE,
  1072: CONDITION.DRIZZLE,
  1180: CONDITION.RAIN,
  1183: CONDITION.RAIN,
  1186: CONDITION.RAIN,
  1189: CONDITION.RAIN,
  1240: CONDITION.RAIN,
  1198: CONDITION.RAIN,
  1192: CONDITION.HEAVY_RAIN,
  1195: CONDITION.HEAVY_RAIN,
  1201: CONDITION.HEAVY_RAIN,
  1243: CONDITION.HEAVY_RAIN,
  1246: CONDITION.HEAVY_RAIN,
  1087: CONDITION.THUNDERSTORM,
  1273: CONDITION.THUNDERSTORM,
  1276: CONDITION.THUNDERSTORM,
  1279: CONDITION.THUNDERSTORM,
  1282: CONDITION.THUNDERSTORM,
  1066: CONDITION.SNOW,
  1114: CONDITION.SNOW,
  1117: CONDITION.SNOW,
  1210: CONDITION.SNOW,
  1213: CONDITION.SNOW,
  1216: CONDITION.SNOW,
  1219: CONDITION.SNOW,
  1222: CONDITION.SNOW,
  1225: CONDITION.SNOW,
  1255: CONDITION.SNOW,
  1258: CONDITION.SNOW,
  1069: CONDITION.SLEET,
  1204: CONDITION.SLEET,
  1207: CONDITION.SLEET,
  1237: CONDITION.SLEET,
  1249: CONDITION.SLEET,
  1252: CONDITION.SLEET,
  1261: CONDITION.SLEET,
  1264: CONDITION.SLEET,
};

// WMO weather code -> [internal enum, label]. Open-Meteo returns only a code.
const WMO_MAP = {
  0: [CONDITION.CLEAR, 'Clear sky'],
  1: [CONDITION.CLEAR, 'Mainly clear'],
  2: [CONDITION.PARTLY_CLOUDY, 'Partly cloudy'],
  3: [CONDITION.CLOUDY, 'Overcast'],
  45: [CONDITION.FOG, 'Fog'],
  48: [CONDITION.FOG, 'Depositing rime fog'],
  51: [CONDITION.DRIZZLE, 'Light drizzle'],
  53: [CONDITION.DRIZZLE, 'Moderate drizzle'],
  55: [CONDITION.DRIZZLE, 'Dense drizzle'],
  56: [CONDITION.DRIZZLE, 'Light freezing drizzle'],
  57: [CONDITION.DRIZZLE, 'Dense freezing drizzle'],
  61: [CONDITION.RAIN, 'Slight rain'],
  63: [CONDITION.RAIN, 'Moderate rain'],
  65: [CONDITION.HEAVY_RAIN, 'Heavy rain'],
  66: [CONDITION.RAIN, 'Light freezing rain'],
  67: [CONDITION.HEAVY_RAIN, 'Heavy freezing rain'],
  71: [CONDITION.SNOW, 'Slight snow'],
  73: [CONDITION.SNOW, 'Moderate snow'],
  75: [CONDITION.SNOW, 'Heavy snow'],
  77: [CONDITION.SNOW, 'Snow grains'],
  80: [CONDITION.RAIN, 'Slight rain showers'],
  81: [CONDITION.RAIN, 'Moderate rain showers'],
  82: [CONDITION.HEAVY_RAIN, 'Violent rain showers'],
  85: [CONDITION.SNOW, 'Slight snow showers'],
  86: [CONDITION.SNOW, 'Heavy snow showers'],
  95: [CONDITION.THUNDERSTORM, 'Thunderstorm'],
  96: [CONDITION.THUNDERSTORM, 'Thunderstorm with slight hail'],
  99: [CONDITION.THUNDERSTORM, 'Thunderstorm with heavy hail'],
};

/** WeatherAPI condition object -> normalized condition. */
function fromWeatherApi(conditionObj = {}, isDay = true) {
  const code = conditionObj.code;
  const internal = WEATHERAPI_MAP[code] || CONDITION.UNKNOWN;
  return {
    internal,
    text: conditionObj.text || CONDITION_LABEL[internal],
    code: code ?? null,
    isDay: Boolean(isDay),
  };
}

/** WMO code -> normalized condition. */
function fromWmo(code, isDay = true) {
  const entry = WMO_MAP[code];
  const internal = entry ? entry[0] : CONDITION.UNKNOWN;
  const text = entry ? entry[1] : CONDITION_LABEL[internal];
  return { internal, text, code: code ?? null, isDay: Boolean(isDay) };
}

/** Build the standard meta block attached to every weather response. */
function buildMeta({ source, ttlSeconds, cached = false }) {
  return {
    source,
    cached,
    cachedAt: Date.now(),
    ttlSeconds,
  };
}

/** Round to a fixed number of decimals, tolerating null/undefined. */
function round(n, decimals = 1) {
  if (n == null || Number.isNaN(Number(n))) return null;
  const f = 10 ** decimals;
  return Math.round(Number(n) * f) / f;
}

module.exports = {
  CONDITION,
  CONDITION_LABEL,
  fromWeatherApi,
  fromWmo,
  buildMeta,
  round,
};
