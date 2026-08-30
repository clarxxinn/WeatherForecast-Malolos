/**
 * Chart.js helpers, theme- and unit-aware. Every builder registers itself so a
 * single 'themechange'/'unitchange' listener can rebuild all live charts with
 * fresh colors and converted temperatures — page controllers call a builder once
 * and never worry about recoloring. Charts read their palette from CSS custom
 * properties (see themes.css), so light/dark just works.
 *
 * All source values are Celsius / millimetres straight from the API; conversion
 * to °F happens here at render time only. No values are synthesized.
 */

import { cssVar } from './theme.js';
import { getUnit } from './units.js';
import { cToF, formatWeekday, formatHourLabel, formatMonthDay } from './format.js';

const registry = new Map(); // canvas -> { build: () => Chart, inst: Chart }

function hasLib() {
  return typeof window.Chart !== 'undefined';
}

function baseDefaults() {
  if (!hasLib() || baseDefaults.done) return;
  const { Chart } = window;
  Chart.defaults.font.family = "'IBM Plex Sans', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation = { duration: 500 };
  baseDefaults.done = true;
}

function palette() {
  return {
    axis: cssVar('--chart-axis'),
    grid: cssVar('--chart-grid'),
    temp: cssVar('--chart-temp'),
    temp2: cssVar('--chart-temp-2'),
    rain: cssVar('--chart-rain'),
    ink: cssVar('--ink'),
    surface: cssVar('--surface'),
  };
}

const conv = (c, unit) => (c == null ? null : unit === 'f' ? cToF(c) : c);

/** Register (or replace) the chart on a canvas and remember how to rebuild it. */
function register(canvas, build) {
  if (!canvas) return;
  destroy(canvas);
  registry.set(canvas, { build, inst: build() });
}

function destroy(canvas) {
  const entry = registry.get(canvas);
  if (entry?.inst) entry.inst.destroy();
  registry.delete(canvas);
}

function refreshAll() {
  for (const [canvas, entry] of registry) {
    if (!document.body.contains(canvas)) {
      entry.inst?.destroy();
      registry.delete(canvas);
      continue;
    }
    entry.inst?.destroy();
    entry.inst = entry.build();
  }
}
document.addEventListener('themechange', refreshAll);
document.addEventListener('unitchange', refreshAll);

// --- Shared option builders ------------------------------------------------

function gridScale(p, { title, suffix = '', beginAtZero = false } = {}) {
  return {
    grid: { color: p.grid, drawTicks: false },
    border: { display: false },
    beginAtZero,
    ticks: { color: p.axis, padding: 8, callback: (v) => `${v}${suffix}` },
    title: title ? { display: true, text: title, color: p.axis } : undefined,
  };
}

function catScale(p) {
  return { grid: { display: false }, border: { color: p.grid }, ticks: { color: p.axis } };
}

function tooltip(p, label) {
  return {
    backgroundColor: p.ink,
    titleColor: p.surface,
    bodyColor: p.surface,
    padding: 10,
    cornerRadius: 8,
    displayColors: false,
    callbacks: label ? { label } : undefined,
  };
}

function areaGradient(ctx, area, color) {
  if (!area) return color;
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, cssVar('--chart-fill'));
  g.addColorStop(1, 'transparent');
  return g;
}

// --- Public builders -------------------------------------------------------

/** 7-day high/low as a filled band with two lines. `days` = daily[].  */
export function tempTrendChart(canvas, days, legendEl) {
  if (!hasLib() || !canvas) return;
  baseDefaults();
  register(canvas, () => {
    const p = palette();
    const unit = getUnit();
    const u = unit.toUpperCase();
    const labels = days.map((d) => formatWeekday(d.dateEpoch));
    const highs = days.map((d) => conv(d.maxC, unit));
    const lows = days.map((d) => conv(d.minC, unit));
    if (legendEl)
      renderLegend(legendEl, [
        { label: `High °${u}`, color: p.temp },
        { label: `Low °${u}`, color: p.temp2 },
      ]);
    return new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `High °${u}`,
            data: highs,
            borderColor: p.temp,
            backgroundColor: p.temp,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
          {
            label: `Low °${u}`,
            data: lows,
            borderColor: p.temp2,
            backgroundColor: (c) => areaGradient(c.chart.ctx, c.chart.chartArea, p.temp2),
            fill: '-1',
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: catScale(p), y: gridScale(p, { suffix: '°' }) },
        plugins: {
          tooltip: tooltip(p, (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)}°${u}`),
        },
      },
    });
  });
}

/** 7-day rain: chance-of-rain bars + precip-total line on a second axis. */
export function rainOutlookChart(canvas, days, legendEl) {
  if (!hasLib() || !canvas) return;
  baseDefaults();
  register(canvas, () => {
    const p = palette();
    const labels = days.map((d) => formatWeekday(d.dateEpoch));
    const chance = days.map((d) => d.chanceOfRain ?? 0);
    const precip = days.map((d) => d.precipMm ?? 0);
    if (legendEl)
      renderLegend(legendEl, [
        { label: 'Chance of rain', color: p.rain, shape: 'bar' },
        { label: 'Total (mm)', color: p.temp2 },
      ]);
    return new window.Chart(canvas, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Chance of rain',
            data: chance,
            backgroundColor: withAlpha(p.rain, 0.55),
            borderRadius: 5,
            yAxisID: 'y',
            maxBarThickness: 34,
          },
          {
            type: 'line',
            label: 'Total (mm)',
            data: precip,
            borderColor: p.temp2,
            backgroundColor: p.temp2,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: catScale(p),
          y: { ...gridScale(p, { suffix: '%', beginAtZero: true }), min: 0, max: 100 },
          y1: {
            ...gridScale(p, { suffix: ' mm', beginAtZero: true }),
            position: 'right',
            grid: { display: false },
            min: 0,
          },
        },
        plugins: {
          tooltip: tooltip(p, (ctx) =>
            ctx.dataset.yAxisID === 'y'
              ? `Chance of rain: ${Math.round(ctx.parsed.y)}%`
              : `Total: ${ctx.parsed.y} mm`
          ),
        },
      },
    });
  });
}

/** History temperature. Hourly → one line; daily → hi/lo band + average. */
export function historyTempChart(canvas, points, granularity, legendEl) {
  if (!hasLib() || !canvas) return;
  baseDefaults();
  register(canvas, () => {
    const p = palette();
    const unit = getUnit();
    const u = unit.toUpperCase();
    const daily = granularity === 'daily';
    const labels = points.map((pt) =>
      daily ? formatMonthDay(pt.timeEpoch) : formatHourLabel(pt.timeEpoch)
    );
    const datasets = daily
      ? [
          {
            label: `High °${u}`,
            data: points.map((pt) => conv(pt.tempMaxC, unit)),
            borderColor: p.temp,
            backgroundColor: p.temp,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: `Low °${u}`,
            data: points.map((pt) => conv(pt.tempMinC, unit)),
            borderColor: p.temp2,
            backgroundColor: (c) => areaGradient(c.chart.ctx, c.chart.chartArea, p.temp2),
            fill: '-1',
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ]
      : [
          {
            label: `Temp °${u}`,
            data: points.map((pt) => conv(pt.tempC, unit)),
            borderColor: p.temp,
            backgroundColor: (c) => areaGradient(c.chart.ctx, c.chart.chartArea, p.temp),
            fill: 'origin',
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ];
    if (legendEl) {
      renderLegend(
        legendEl,
        daily
          ? [
              { label: `High °${u}`, color: p.temp },
              { label: `Low °${u}`, color: p.temp2 },
            ]
          : [{ label: `Temperature °${u}`, color: p.temp }]
      );
    }
    return new window.Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ...catScale(p), ticks: { color: p.axis, maxTicksLimit: daily ? 10 : 8 } },
          y: gridScale(p, { suffix: '°' }),
        },
        plugins: {
          tooltip: tooltip(p, (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y)}°${u}`),
        },
      },
    });
  });
}

/** History rainfall bars (mm). */
export function historyRainChart(canvas, points, granularity) {
  if (!hasLib() || !canvas) return;
  baseDefaults();
  register(canvas, () => {
    const p = palette();
    const daily = granularity === 'daily';
    const labels = points.map((pt) =>
      daily ? formatMonthDay(pt.timeEpoch) : formatHourLabel(pt.timeEpoch)
    );
    return new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Rain (mm)',
            data: points.map((pt) => pt.precipMm ?? 0),
            backgroundColor: withAlpha(p.rain, 0.7),
            borderRadius: 4,
            maxBarThickness: daily ? 22 : 14,
          },
        ],
      },
      options: {
        scales: {
          x: { ...catScale(p), ticks: { color: p.axis, maxTicksLimit: daily ? 12 : 8 } },
          y: gridScale(p, { suffix: ' mm', beginAtZero: true }),
        },
        plugins: { tooltip: tooltip(p, (ctx) => `${ctx.parsed.y} mm`) },
      },
    });
  });
}

// --- Small helpers ---------------------------------------------------------

function renderLegend(host, items) {
  host.replaceChildren(
    ...items.map((it) => {
      const sw = document.createElement('span');
      sw.className = 'legend-swatch';
      sw.style.background = it.color;
      if (it.shape === 'bar') sw.style.height = '10px';
      const wrap = document.createElement('span');
      wrap.className = 'legend-item';
      const label = document.createElement('span');
      label.textContent = it.label;
      wrap.append(sw, label);
      return wrap;
    })
  );
}

/** Accept a hex or rgb() var and return an rgba() at the given alpha. */
function withAlpha(color, alpha) {
  const c = color.trim();
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}

export { destroy as destroyChart };
