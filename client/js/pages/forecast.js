/**
 * Forecast controller. The 7-day outlook (Open-Meteo, keyless) drives the daily
 * rows and both charts; the hourly strip needs the current-conditions provider
 * and degrades to a clear notice without a key. Charts recolor/reconvert
 * themselves on theme/unit change (see charts.js); the plain widgets re-render
 * from cached data on unit change here.
 */

import { initChrome } from '../nav.js';
import { apiGet, ApiError } from '../api.js';
import { qs, mount, el, icon, errorState, noticeState, emptyState } from '../ui.js';
import { dailyRows, hourlyStrip } from '../render.js';
import { relativeFromNow } from '../format.js';
import { tempTrendChart, rainOutlookChart } from '../charts.js';

initChrome();

let days = null;
let hours = null;

function skelList(host, n = 6) {
  mount(host, el('div', { class: 'skeleton-list' }, Array.from({ length: n }, () => el('div', { class: 'skeleton' }))));
}

// --- Daily + charts --------------------------------------------------------

async function loadDaily() {
  const dailyHost = qs('#daily');
  skelList(dailyHost, 7);
  mount(qs('#temp-chart-host'), el('div', { class: 'skeleton chart-skel' }));
  mount(qs('#precip-chart-host'), el('div', { class: 'skeleton chart-skel' }));
  try {
    const data = await apiGet('/forecast/daily?days=7');
    days = data.days || [];
    const stamp = qs('#daily-stamp');
    if (stamp) stamp.textContent = `${(data.meta?.source || 'open-meteo').toUpperCase()} · updated ${relativeFromNow(data.meta?.cachedAt || Date.now())}`;
    renderDaily();
    renderCharts();
  } catch (err) {
    days = null;
    mount(dailyHost, errorState(err, loadDaily));
    mount(qs('#temp-chart-host'), errorState(err, loadDaily));
    mount(qs('#precip-chart-host'), errorState(err, loadDaily));
  }
}

function renderDaily() {
  if (days?.length) mount(qs('#daily'), dailyRows(days));
}

function renderCharts() {
  if (!days?.length) return;
  if (typeof window.Chart === 'undefined') {
    const note = () => noticeState({ icon: 'chart-line', title: 'Charts unavailable', message: 'The charting library could not be loaded.' });
    mount(qs('#temp-chart-host'), note());
    mount(qs('#precip-chart-host'), note());
    return;
  }
  // Restore canvases (they may have been replaced by a skeleton/error).
  mount(qs('#temp-chart-host'), chartCanvas('temp-chart', '7-day high and low'), el('div', { id: 'temp-legend', class: 'chart-legend' }));
  mount(qs('#precip-chart-host'), chartCanvas('precip-chart', '7-day rain outlook'), el('div', { id: 'precip-legend', class: 'chart-legend' }));
  tempTrendChart(qs('#temp-chart'), days, qs('#temp-legend'));
  rainOutlookChart(qs('#precip-chart'), days, qs('#precip-legend'));
}

function chartCanvas(id, label) {
  return el('div', { class: 'chart-wrap' }, el('canvas', { id, role: 'img', 'aria-label': label }));
}

// --- Hourly ----------------------------------------------------------------

async function loadHourly() {
  const host = qs('#hourly');
  mount(host, el('div', { class: 'skeleton-list' }, Array.from({ length: 3 }, () => el('div', { class: 'skeleton' }))));
  try {
    const data = await apiGet('/forecast/hourly?hours=24');
    hours = data.hours || [];
    const stamp = qs('#hourly-stamp');
    if (stamp) stamp.textContent = `${(data.meta?.source || 'weather').toUpperCase()} · next 24 hours`;
    renderHourly();
  } catch (err) {
    hours = null;
    if (err instanceof ApiError && err.code === 'WEATHER_API_KEY_MISSING') {
      mount(host, noticeState({
        icon: 'key-round',
        title: 'Hourly forecast not configured',
        message: 'The hourly forecast needs a WeatherAPI key on the server. The daily outlook and charts above use Open-Meteo and work without one.',
      }));
    } else {
      mount(host, errorState(err, loadHourly));
    }
  }
}

function renderHourly() {
  if (hours?.length) mount(qs('#hourly'), hourlyStrip(hours, { max: 24 }));
  else if (hours) mount(qs('#hourly'), emptyState('No hourly data available.'));
}

// --- Boot ------------------------------------------------------------------

document.addEventListener('unitchange', () => {
  renderDaily();
  renderHourly();
  // charts.js rebuilds its own charts on unitchange
});

loadDaily();
loadHourly();
