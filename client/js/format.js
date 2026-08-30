/**
 * All human-facing formatting. Every timestamp is rendered in Asia/Manila via
 * Intl regardless of the viewer's device timezone — this is a Malolos station,
 * so the clock is always Philippine time. Units convert on demand for the
 * temperature-unit preference (°C default, °F opt-in).
 */

import { CONFIG } from './config.js';

const TZ = CONFIG.timeZone;
const LOCALE = 'en-PH';

// Intl.DateTimeFormat is expensive to construct — build each once and reuse.
const fmt = {
  time: new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: 'numeric', minute: '2-digit' }),
  hour: new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: 'numeric' }),
  weekday: new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: 'short' }),
  weekdayLong: new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: 'long' }),
  monthDay: new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, month: 'short', day: 'numeric' }),
  full: new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }),
  clock: new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }),
};

const asDate = (epoch) => (epoch instanceof Date ? epoch : new Date(Number(epoch)));

export const formatTime = (epoch) => fmt.time.format(asDate(epoch));
export const formatHourLabel = (epoch) => fmt.hour.format(asDate(epoch)).replace(/\s/g, '');
export const formatWeekday = (epoch) => fmt.weekday.format(asDate(epoch));
export const formatWeekdayLong = (epoch) => fmt.weekdayLong.format(asDate(epoch));
export const formatMonthDay = (epoch) => fmt.monthDay.format(asDate(epoch));
export const formatFullDate = (epoch) => fmt.full.format(asDate(epoch));
export const formatClock = (date = new Date()) => fmt.clock.format(date);

/** "just now" / "3 min ago" / "2 h ago" from an epoch-ms. */
export function relativeFromNow(epoch) {
  const diffSec = Math.round((Date.now() - Number(epoch)) / 1000);
  if (diffSec < 45) return 'just now';
  if (diffSec < 90) return '1 min ago';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  return `${day} d ago`;
}

// --- Units -----------------------------------------------------------------

export const cToF = (c) => (c * 9) / 5 + 32;

/** Temperature as a bare rounded number in the chosen unit (no degree glyph). */
export function tempValue(celsius, unit = 'c') {
  if (celsius == null || Number.isNaN(Number(celsius))) return '—';
  const v = unit === 'f' ? cToF(celsius) : Number(celsius);
  return String(Math.round(v));
}

/** Temperature with degree + unit letter, e.g. "27°C". */
export function tempFull(celsius, unit = 'c') {
  const v = tempValue(celsius, unit);
  return v === '—' ? '—' : `${v}°${unit.toUpperCase()}`;
}

export const unitSymbol = (unit = 'c') => `°${unit.toUpperCase()}`;

/** Compass direction (already a string from the API) with a fallback. */
export const windDirText = (dir) => dir || '—';

/** Round a possibly-null number to n decimals for display; em dash otherwise. */
export function num(n, decimals = 0) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const f = 10 ** decimals;
  return String(Math.round(Number(n) * f) / f);
}

/** Coordinates as an instrument-style readout: "14.8433°N 120.8114°E". */
export function coordsText(lat, lon) {
  if (lat == null || lon == null) return '';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns} ${Math.abs(lon).toFixed(4)}°${ew}`;
}
