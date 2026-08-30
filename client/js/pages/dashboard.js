/**
 * Dashboard controller. Fetches the four data sections in parallel and renders
 * each independently, so a failure or missing-key in one never blanks the page.
 * The hero shows live current conditions when available; when the current-
 * conditions provider isn't configured (no API key), it falls back to today's
 * live forecast (clearly labeled) rather than inventing a reading. Unit changes
 * re-render from cached data; a timer refreshes on the same cadence as the
 * server cache window.
 */

import { initChrome } from '../nav.js';
import { apiGet, ApiError } from '../api.js';
import { CONFIG } from '../config.js';
import { qs, mount, el, icon, noticeState, emptyState, errorState, skeletons, shimmer } from '../ui.js';
import { hourlyStrip, dailyRows, metricCard, alertCard } from '../render.js';
import { iconFor, skyClassFor, conditionText } from '../icons.js';
import { getUnit } from '../units.js';
import { tempValue, num, relativeFromNow, formatTime, windDirText } from '../format.js';

initChrome();

let last = null; // { weather, hourly, daily, alerts } — settled results

async function loadAll() {
  const results = await Promise.allSettled([
    apiGet('/weather'),
    apiGet('/forecast/hourly?hours=24'),
    apiGet('/forecast/daily?days=7'),
    apiGet('/alerts'),
  ]);
  last = {
    weather: results[0],
    hourly: results[1],
    daily: results[2],
    alerts: results[3],
  };
  renderAll();
}

function renderAll() {
  if (!last) return;
  renderHero();
  renderMetrics();
  renderHourly();
  renderAstro();
  renderAirQuality();
  renderAlertPreview();
  renderDailyMini();
}

// --- Hero ------------------------------------------------------------------

function renderHero() {
  const host = qs('#hero');
  if (!host) return;
  host.removeAttribute('aria-busy');
  const w = last.weather;

  if (w.status === 'fulfilled') {
    const { location, current, meta } = w.value;
    host.className = `hero ${skyClassFor(current.condition)}`;
    mount(host, heroLive(location, current, meta));
    return;
  }

  // No current-conditions provider: fall back to today's live forecast.
  const d = last.daily;
  if (d.status === 'fulfilled' && d.value.days?.length) {
    const day = d.value.days[0];
    host.className = `hero ${skyClassFor(day.condition)}`;
    mount(host, heroForecast(d.value.location, day));
  } else {
    host.className = 'hero hero--skeleton';
    mount(host, el('div', { class: 'state state--notice' }, heroErrorInner(w.reason)));
  }
}

function heroLive(location, current, meta) {
  const unit = getUnit();
  return el(
    'div',
    { class: 'hero__inner' },
    el(
      'div',
      { class: 'hero__top' },
      el(
        'div',
        { class: 'hero__place' },
        el('strong', { text: location.name }),
        el('span', { text: `${location.region}, ${location.country}` })
      ),
      el(
        'div',
        { class: 'hero__stamp' },
        el('span', { text: `Updated ${relativeFromNow(current.observedAtEpoch)}` }),
        el('span', { text: meta.cached ? 'Cached reading' : 'Live reading' })
      )
    ),
    el(
      'div',
      { class: 'hero__body' },
      el(
        'div',
        { class: 'hero__reading' },
        icon(iconFor(current.condition), 'hero__glyph'),
        el(
          'div',
          {},
          el('div', { class: 'hero__temp' }, `${tempValue(current.tempC, unit)}`, el('sup', { text: `°${unit.toUpperCase()}` })),
          el('div', { class: 'hero__cond', text: conditionText(current.condition) }),
          el('div', { class: 'hero__feels', text: `Feels like ${tempValue(current.feelsLikeC, unit)}°` })
        )
      ),
      el(
        'div',
        { class: 'hero__strip' },
        heroStat('Humidity', `${num(current.humidity)}%`),
        heroStat('Wind', `${num(current.windKph)} km/h`),
        heroStat('UV index', num(current.uv)),
        heroStat('Cloud', `${num(current.cloud)}%`)
      )
    )
  );
}

function heroForecast(location, day) {
  const unit = getUnit();
  return el(
    'div',
    { class: 'hero__inner' },
    el(
      'div',
      { class: 'hero__top' },
      el(
        'div',
        { class: 'hero__place' },
        el('strong', { text: location.name }),
        el('span', { text: `${location.region}, ${location.country}` })
      ),
      el(
        'div',
        { class: 'hero__stamp' },
        el('span', { text: 'Today’s forecast' }),
        el('span', { text: 'Live current conditions unavailable' })
      )
    ),
    el(
      'div',
      { class: 'hero__body' },
      el(
        'div',
        { class: 'hero__reading' },
        icon(iconFor(day.condition), 'hero__glyph'),
        el(
          'div',
          {},
          el('div', { class: 'hero__temp' }, `${tempValue(day.maxC, unit)}`, el('sup', { text: `°${unit.toUpperCase()}` })),
          el('div', { class: 'hero__cond', text: conditionText(day.condition) }),
          el('div', { class: 'hero__feels', text: `Low ${tempValue(day.minC, unit)}° · High ${tempValue(day.maxC, unit)}°` })
        )
      ),
      el(
        'div',
        { class: 'hero__strip' },
        heroStat('Chance of rain', `${num(day.chanceOfRain)}%`),
        heroStat('Max wind', `${num(day.maxWindKph)} km/h`),
        heroStat('UV index', num(day.uv)),
        heroStat('Rain total', `${num(day.precipMm, 1)} mm`)
      )
    )
  );
}

function heroStat(label, value) {
  return el(
    'div',
    { class: 'hero__stat' },
    el('span', { class: 'hero__stat-label', text: label }),
    el('span', { class: 'hero__stat-value', text: value })
  );
}

function heroErrorInner(reason) {
  return [
    icon('cloud-off', 'state__icon'),
    el('p', { class: 'state__title', text: 'Conditions unavailable' }),
    el('p', { class: 'state__msg', text: reason?.message || 'Weather data could not be loaded right now.' }),
  ];
}

// --- Metrics ---------------------------------------------------------------

function renderMetrics() {
  const host = qs('#metrics');
  const stamp = qs('#metrics-stamp');
  if (!host) return;
  const w = last.weather;

  if (w.status !== 'fulfilled') {
    if (stamp) stamp.textContent = '';
    mount(
      host,
      keyNotice(
        w.reason,
        'Live current conditions need a WeatherAPI key configured on the server. The forecast, history, and advisories below still work.'
      )
    );
    return;
  }

  const { current, meta } = w.value;
  const unit = getUnit();
  if (stamp) {
    stamp.replaceChildren(
      el('span', { text: (meta.source || 'weather').toUpperCase() }),
      el('span', { class: 'dot', text: '·' }),
      el('span', { text: `updated ${relativeFromNow(current.observedAtEpoch)}` })
    );
  }
  mount(
    host,
    metricCard({ label: 'Feels like', iconName: 'thermometer', value: `${tempValue(current.feelsLikeC, unit)}°` }),
    metricCard({ label: 'Humidity', iconName: 'droplets', value: num(current.humidity), unit: '%' }),
    metricCard({ label: 'Wind', iconName: 'wind', value: num(current.windKph), unit: 'km/h', foot: `Direction ${windDirText(current.windDir)}` }),
    metricCard({ label: 'UV index', iconName: 'sun', value: num(current.uv), foot: uvWord(current.uv) }),
    metricCard({ label: 'Pressure', iconName: 'gauge', value: num(current.pressureMb), unit: 'mb' }),
    metricCard({ label: 'Visibility', iconName: 'eye', value: num(current.visKm), unit: 'km' }),
    metricCard({ label: 'Cloud cover', iconName: 'cloud', value: num(current.cloud), unit: '%' }),
    metricCard({ label: 'Precip', iconName: 'cloud-rain', value: num(current.precipMm, 1), unit: 'mm' })
  );
}

function uvWord(uv) {
  if (uv == null) return '';
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

// --- Hourly ----------------------------------------------------------------

function renderHourly() {
  const host = qs('#hourly');
  if (!host) return;
  const h = last.hourly;
  if (h.status === 'fulfilled' && h.value.hours?.length) {
    mount(host, hourlyStrip(h.value.hours, { max: 24 }));
  } else if (h.status !== 'fulfilled') {
    mount(host, keyNotice(h.reason, 'The hourly forecast needs a WeatherAPI key on the server.'));
  } else {
    mount(host, emptyState('No hourly data available.'));
  }
}

// --- Sun & daylight (from daily[0], keyless) -------------------------------

function renderAstro() {
  const host = qs('#today-astro');
  if (!host) return;
  const d = last.daily;
  if (d.status !== 'fulfilled' || !d.value.days?.length) {
    mount(host, errorState(d.reason || new Error('No data'), loadAll));
    return;
  }
  const day = d.value.days[0];
  if (!day.sunriseEpoch || !day.sunsetEpoch) {
    mount(host, emptyState('Sun times unavailable.', 'sunrise'));
    return;
  }
  const daylightMin = Math.round((day.sunsetEpoch - day.sunriseEpoch) / 60000);
  const hrs = Math.floor(daylightMin / 60);
  const mins = daylightMin % 60;
  mount(
    host,
    el(
      'div',
      { class: 'metric-grid' },
      metricCard({ label: 'Sunrise', iconName: 'sunrise', value: formatTime(day.sunriseEpoch) }),
      metricCard({ label: 'Sunset', iconName: 'sunset', value: formatTime(day.sunsetEpoch) }),
      metricCard({ label: 'Daylight', iconName: 'sun', value: `${hrs}h ${mins}m` })
    )
  );
}

// --- Air quality -----------------------------------------------------------

function renderAirQuality() {
  const host = qs('#air-quality');
  if (!host) return;
  const w = last.weather;
  if (w.status !== 'fulfilled') {
    mount(host, keyNotice(w.reason, 'Air quality comes from the current-conditions provider.'));
    return;
  }
  const aqi = w.value.current.aqi;
  if (!aqi || aqi.usEpaIndex == null) {
    mount(host, emptyState('Air quality data isn’t available for this reading.', 'wind'));
    return;
  }
  mount(
    host,
    el(
      'div',
      { class: 'metric-grid' },
      metricCard({ label: 'US EPA index', iconName: 'gauge', value: num(aqi.usEpaIndex), foot: aqi.category || '' }),
      metricCard({ label: 'PM2.5', iconName: 'circle-dot', value: num(aqi.pm2_5, 1), unit: 'µg/m³' }),
      metricCard({ label: 'PM10', iconName: 'circle-dot', value: num(aqi.pm10, 1), unit: 'µg/m³' })
    )
  );
}

// --- Alert preview ---------------------------------------------------------

function renderAlertPreview() {
  const host = qs('#alert-preview');
  if (!host) return;
  const a = last.alerts;
  if (a.status !== 'fulfilled') {
    mount(host, errorState(a.reason, loadAll));
    return;
  }
  const { official = [], derived = [] } = a.value;
  const cards = [
    ...official.slice(0, 2).map((x) => alertCard(x, { derived: false })),
    ...derived.slice(0, Math.max(0, 2 - official.length)).map((x) => alertCard(x, { derived: true })),
  ];
  if (!cards.length) {
    mount(host, emptyState('No active alerts or advisories for Malolos.', 'shield-check'));
    return;
  }
  mount(host, el('div', { class: 'alert-stack' }, cards));
}

// --- 7-day mini ------------------------------------------------------------

function renderDailyMini() {
  const host = qs('#daily-mini');
  if (!host) return;
  const d = last.daily;
  if (d.status === 'fulfilled' && d.value.days?.length) {
    mount(host, dailyRows(d.value.days.slice(0, 7)));
  } else {
    mount(host, errorState(d.reason || new Error('No data'), loadAll));
  }
}

// --- Shared: friendly notice for a missing-key / unavailable section -------

function keyNotice(reason, message) {
  if (reason instanceof ApiError && reason.code === 'WEATHER_API_KEY_MISSING') {
    return noticeState({ icon: 'key-round', title: 'Live conditions not configured', message });
  }
  return errorState(reason || new Error('Unavailable'), loadAll);
}

// --- Boot ------------------------------------------------------------------

// Loading placeholders while the first fetch is in flight.
mount(qs('#metrics'), skeletons(8, 'metric-grid', 'metric-card'));
qs('#hero')?.append(shimmer('hero__inner'));
mount(qs('#hourly'), skeletons(8, 'hourly', 'hour'));

document.addEventListener('unitchange', renderAll);
setInterval(loadAll, CONFIG.refreshMs);
loadAll();
