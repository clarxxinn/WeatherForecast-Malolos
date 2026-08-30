/**
 * History controller. A range switch (24h / 7d / 30d) drives one fetch of
 * /api/history; the response's granularity (hourly vs daily) decides how the
 * charts and summary tiles are shaped. All values are observations from
 * Open-Meteo — the summary stats are computed from those points, never faked.
 */

import { initChrome } from '../nav.js';
import { apiGet } from '../api.js';
import { qs, qsa, mount, el, errorState, emptyState, noticeState, skeletons } from '../ui.js';
import { metricCard } from '../render.js';
import { getUnit } from '../units.js';
import { tempValue, num } from '../format.js';
import { historyTempChart, historyRainChart } from '../charts.js';

initChrome();

let state = { range: '24h', data: null };

function setActiveTab(range) {
  qsa('#range-tabs .range-tab').forEach((btn) => {
    const on = btn.dataset.range === range;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', String(on));
  });
}

async function load(range) {
  state.range = range;
  setActiveTab(range);
  mount(qs('#temp-hist-host'), el('div', { class: 'skeleton chart-skel' }));
  mount(qs('#precip-hist-host'), el('div', { class: 'skeleton chart-skel' }));
  mount(qs('#history-stats'), skeletons(4, 'metric-grid', 'metric-card'));

  try {
    const data = await apiGet(`/history?range=${range}`);
    state.data = data;
    const stamp = qs('#temp-hist-stamp');
    if (stamp) stamp.textContent = `${(data.source || data.meta?.source || 'open-meteo').toUpperCase()} · ${data.granularity}`;
    renderStats();
    renderCharts();
  } catch (err) {
    state.data = null;
    mount(qs('#temp-hist-host'), errorState(err, () => load(range)));
    mount(qs('#precip-hist-host'), el('span'));
    mount(qs('#history-stats'), el('span'));
  }
}

function renderCharts() {
  const { points, granularity } = state.data || {};
  if (!points?.length) {
    mount(qs('#temp-hist-host'), emptyState('No history for this range.'));
    mount(qs('#precip-hist-host'), el('span'));
    return;
  }
  if (typeof window.Chart === 'undefined') {
    mount(qs('#temp-hist-host'), noticeState({ icon: 'chart-line', title: 'Charts unavailable', message: 'The charting library could not be loaded.' }));
    mount(qs('#precip-hist-host'), el('span'));
    return;
  }
  mount(qs('#temp-hist-host'), chartCanvas('temp-hist', 'Temperature history'));
  mount(qs('#precip-hist-host'), chartCanvas('precip-hist', 'Rainfall history'));
  historyTempChart(qs('#temp-hist'), points, granularity);
  historyRainChart(qs('#precip-hist'), points, granularity);
}

function chartCanvas(id, label) {
  return el('div', { class: 'chart-wrap' }, el('canvas', { id, role: 'img', 'aria-label': label }));
}

function renderStats() {
  const host = qs('#history-stats');
  const { points, granularity } = state.data || {};
  if (!points?.length) {
    mount(host, emptyState('No data for this range.', 'chart-line'));
    return;
  }
  const unit = getUnit();
  const cards = granularity === 'daily' ? dailyStats(points, unit) : hourlyStats(points, unit);
  mount(host, ...cards);
}

const finite = (arr) => arr.filter((v) => v != null && !Number.isNaN(Number(v)));
const sum = (arr) => finite(arr).reduce((a, b) => a + Number(b), 0);

function hourlyStats(points, unit) {
  const temps = finite(points.map((p) => p.tempC));
  const totalRain = sum(points.map((p) => p.precipMm));
  const winds = finite(points.map((p) => p.windKph));
  const hums = finite(points.map((p) => p.humidity));
  const avgHum = hums.length ? Math.round(sum(hums) / hums.length) : null;
  return [
    metricCard({ label: 'Warmest', iconName: 'thermometer-sun', value: temps.length ? `${tempValue(Math.max(...temps), unit)}°` : '—' }),
    metricCard({ label: 'Coolest', iconName: 'thermometer-snowflake', value: temps.length ? `${tempValue(Math.min(...temps), unit)}°` : '—' }),
    metricCard({ label: 'Total rain', iconName: 'cloud-rain', value: num(totalRain, 1), unit: 'mm' }),
    metricCard({ label: 'Peak wind', iconName: 'wind', value: winds.length ? num(Math.max(...winds)) : '—', unit: 'km/h', foot: avgHum != null ? `Avg humidity ${avgHum}%` : '' }),
  ];
}

function dailyStats(points, unit) {
  const highs = finite(points.map((p) => p.tempMaxC));
  const lows = finite(points.map((p) => p.tempMinC));
  const totalRain = sum(points.map((p) => p.precipMm));
  const wetDays = points.filter((p) => (p.precipMm ?? 0) >= 1).length;
  return [
    metricCard({ label: 'Highest', iconName: 'thermometer-sun', value: highs.length ? `${tempValue(Math.max(...highs), unit)}°` : '—' }),
    metricCard({ label: 'Lowest', iconName: 'thermometer-snowflake', value: lows.length ? `${tempValue(Math.min(...lows), unit)}°` : '—' }),
    metricCard({ label: 'Total rain', iconName: 'cloud-rain', value: num(totalRain, 1), unit: 'mm' }),
    metricCard({ label: 'Rainy days', iconName: 'umbrella', value: num(wetDays), foot: `of ${points.length} days` }),
  ];
}

// --- Boot ------------------------------------------------------------------

qsa('#range-tabs .range-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.range !== state.range) load(btn.dataset.range);
  });
});

document.addEventListener('unitchange', () => {
  if (state.data) renderStats(); // charts.js handles its own recolor/reconvert
});

load('24h');
