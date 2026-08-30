/**
 * Reusable render fragments shared by the page controllers: the hourly strip,
 * the daily forecast rows, metric tiles, and alert cards. Keeping these in one
 * place means the dashboard and the forecast/alerts pages render identical
 * widgets, and unit/icon logic lives in exactly one spot.
 */

import { el, icon } from './ui.js';
import { iconFor, conditionText } from './icons.js';
import { getUnit } from './units.js';
import {
  tempValue,
  formatHourLabel,
  formatWeekday,
  formatMonthDay,
  formatTime,
  num,
} from './format.js';

// --- Hourly strip ----------------------------------------------------------

export function hourlyStrip(hours, { max = 24 } = {}) {
  const unit = getUnit();
  const slice = hours.slice(0, max);
  return el(
    'div',
    { class: 'hourly' },
    slice.map((h, i) =>
      el(
        'div',
        { class: `hour ${i === 0 ? 'hour--now' : ''}`.trim() },
        el('span', { class: 'hour__time', text: i === 0 ? 'Now' : formatHourLabel(h.timeEpoch) }),
        icon(iconFor(h.condition), 'hour__glyph'),
        el('span', { class: 'hour__temp', text: `${tempValue(h.tempC, unit)}°` }),
        h.chanceOfRain > 0
          ? el('span', { class: 'hour__rain' }, icon('droplet'), `${num(h.chanceOfRain)}%`)
          : el('span', { class: 'hour__rain hour__rain--dry', text: '·' })
      )
    )
  );
}

// --- Daily rows ------------------------------------------------------------

export function dailyRows(days) {
  const unit = getUnit();
  // Scale each day's hi/lo bar within the week's overall range.
  const highs = days.map((d) => d.maxC).filter((v) => v != null);
  const lows = days.map((d) => d.minC).filter((v) => v != null);
  const weekMax = Math.max(...highs);
  const weekMin = Math.min(...lows);
  const span = Math.max(weekMax - weekMin, 1);

  return el(
    'div',
    { class: 'daily' },
    days.map((d, i) => {
      const left = ((d.minC - weekMin) / span) * 100;
      const width = ((d.maxC - d.minC) / span) * 100;
      const bar = el(
        'span',
        { class: 'day__bar' },
        el('span', {
          class: 'day__bar-fill',
          style: `left:${left.toFixed(1)}%; width:${Math.max(width, 4).toFixed(1)}%`,
        })
      );
      return el(
        'div',
        { class: 'day' },
        el(
          'span',
          { class: 'day__name' },
          el('strong', { text: i === 0 ? 'Today' : d.dayName || formatWeekday(d.dateEpoch) }),
          el('span', { text: d.dateLabel || formatMonthDay(d.dateEpoch) })
        ),
        el(
          'span',
          { class: 'day__cond' },
          icon(iconFor(d.condition)),
          el('span', { text: conditionText(d.condition) }),
          d.chanceOfRain > 0
            ? el('span', { class: 'day__rain', text: `${num(d.chanceOfRain)}%` })
            : null
        ),
        el(
          'span',
          { class: 'day__range' },
          el('span', { class: 'day__hi', text: `${tempValue(d.maxC, unit)}°` }),
          bar,
          el('span', { class: 'day__lo', text: `${tempValue(d.minC, unit)}°` })
        )
      );
    })
  );
}

// --- Metric tile -----------------------------------------------------------

export function metricCard({ label, iconName, value, unit, foot }) {
  return el(
    'div',
    { class: 'metric-card' },
    el(
      'div',
      { class: 'metric__top' },
      el('span', { class: 'metric__label', text: label }),
      iconName ? icon(iconName, 'metric__icon') : null
    ),
    el(
      'div',
      { class: 'metric__value' },
      String(value),
      unit ? el('small', { text: ` ${unit}` }) : null
    ),
    foot ? el('span', { class: 'metric__foot', text: foot }) : null
  );
}

// --- Alerts ----------------------------------------------------------------

/** Normalize any provider/severity string to our three visual tiers. */
export function sevTier(severity = '') {
  const s = String(severity).toLowerCase();
  if (/(sever|extreme|red|danger|high)/.test(s)) return 'severe';
  if (/(warn|moderate|orange|watch)/.test(s)) return 'warning';
  return 'advisory';
}

function derivedIcon(item) {
  const key = `${item.type || ''} ${item.title || ''}`.toLowerCase();
  if (/heat|temperature|hot/.test(key)) return 'thermometer-sun';
  if (/thunder|storm|lightning/.test(key)) return 'cloud-lightning';
  if (/wind|gust/.test(key)) return 'wind';
  if (/rain|shower|precip|flood/.test(key)) return 'cloud-rain-wind';
  if (/uv|sun/.test(key)) return 'sun';
  return 'info';
}

/**
 * One alert card. `official` alerts render their headline/effective window;
 * `derived` advisories add the required "not official" disclaimer line.
 */
export function alertCard(item, { derived = false } = {}) {
  const tier = sevTier(item.severity || item.rawSeverity);
  const iconName = derived ? derivedIcon(item) : 'triangle-alert';
  const title = item.title || item.headline || item.event || 'Weather alert';

  const head = el(
    'div',
    { class: 'alert-card__head' },
    el('span', { class: 'alert-card__title', text: title }),
    el('span', { class: `sev-chip sev-chip--${tier}`, text: derived ? 'Advisory' : tier })
  );

  const bodyText = derived ? item.message : item.desc || item.headline;
  const body = bodyText ? el('p', { class: 'alert-card__body', text: bodyText }) : null;

  const metaBits = [];
  if (!derived) {
    if (item.effectiveEpoch) metaBits.push(`From ${formatTime(item.effectiveEpoch)}`);
    if (item.expiresEpoch) metaBits.push(`until ${formatTime(item.expiresEpoch)}`);
    if (item.source) metaBits.push(item.source);
  } else {
    if (item.basis) metaBits.push(item.basis);
  }
  const meta = metaBits.length
    ? el('p', { class: 'alert-card__meta', text: metaBits.join(' · ') })
    : null;

  const instruction =
    !derived && item.instruction
      ? el('p', { class: 'alert-card__body', text: item.instruction })
      : null;

  const disclaimer = derived
    ? el(
        'p',
        { class: 'alert-card__disclaimer' },
        icon('info'),
        el('span', {
          text: item.disclaimer || 'Derived from the forecast — not an official warning.',
        })
      )
    : null;

  return el(
    'div',
    { class: `alert-card alert-card--${tier}` },
    icon(iconName, 'alert-card__icon'),
    el('div', {}, head, body, instruction, meta, disclaimer)
  );
}
