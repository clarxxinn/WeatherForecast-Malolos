/**
 * Renders the shared masthead and footer into every page, so the six pages only
 * carry an empty <header id="site-header"> / <footer id="site-footer">. Marks the
 * active link from document.body.dataset.page, runs the live Manila clock, fills
 * the station readout from /api/location, and wires the unit + theme controls and
 * the mobile nav drawer. The account cluster is delegated to auth.js and hides
 * itself when accounts aren't available.
 */

import { apiGet } from './api.js';
import { el, icon, qs, renderIcons } from './ui.js';
import { bindThemeToggle } from './theme.js';
import { bindUnitToggle } from './units.js';
import { formatClock, formatFullDate, coordsText } from './format.js';
import { mountAccount } from './auth.js';

const PAGES = [
  { key: 'dashboard', href: '/', label: 'Dashboard', icon: 'gauge' },
  { key: 'forecast', href: '/forecast', label: 'Forecast', icon: 'calendar-days' },
  { key: 'alerts', href: '/alerts', label: 'Alerts', icon: 'triangle-alert' },
  { key: 'map', href: '/map', label: 'Map', icon: 'map' },
  { key: 'history', href: '/history', label: 'History', icon: 'history' },
  { key: 'about', href: '/about', label: 'About', icon: 'info' },
];

function brandMark() {
  // Custom station glyph: a sun over a horizon with a single fall of rain — the
  // two realities this monitor tracks (tropical heat + monsoon rain).
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('class', 'brand__glyph');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<circle cx="16" cy="12" r="5.2" fill="var(--sun)"/>' +
    '<path d="M4 19h24" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M11 24l-1.5 4M16 24l-1.5 4M21 24l-1.5 4" stroke="var(--sky)" stroke-width="2" stroke-linecap="round"/>';
  return svg;
}

function buildMasthead(activeKey) {
  const links = PAGES.map((p) =>
    el(
      'a',
      {
        class: `nav__link ${p.key === activeKey ? 'is-active' : ''}`.trim(),
        href: p.href,
        'aria-current': p.key === activeKey ? 'page' : false,
      },
      icon(p.icon, 'nav__icon'),
      el('span', { text: p.label })
    )
  );

  const nav = el('nav', { id: 'primary-nav', class: 'nav', 'aria-label': 'Primary' }, links);

  const navToggle = el('button', {
    class: 'icon-btn nav-toggle',
    type: 'button',
    'aria-expanded': 'false',
    'aria-controls': 'primary-nav',
    'aria-label': 'Open menu',
  });
  navToggle.append(icon('menu', 'nav-toggle__open'), icon('x', 'nav-toggle__close'));

  const unitToggle = el(
    'button',
    { id: 'unit-toggle', class: 'seg-toggle', type: 'button' },
    el('span', { class: 'seg-toggle__opt', 'data-for': 'c', text: '°C' }),
    el('span', { class: 'seg-toggle__opt', 'data-for': 'f', text: '°F' })
  );

  const themeToggle = el('button', { id: 'theme-toggle', class: 'icon-btn', type: 'button' });
  themeToggle.append(icon('sun', 'i-sun'), icon('moon', 'i-moon'));

  const clock = el(
    'div',
    { class: 'station-clock', title: 'Malolos station · Philippine time' },
    el('span', { id: 'station-clock-time', class: 'station-clock__time', text: '—' }),
    el('span', { id: 'station-clock-date', class: 'station-clock__date', text: '' })
  );

  const account = el('div', { id: 'account-slot', class: 'account' });

  const bar = el(
    'div',
    { class: 'shell masthead__bar' },
    el(
      'a',
      { class: 'brand', href: '/', 'aria-label': 'Malolos Weather Monitor — dashboard' },
      brandMark(),
      el(
        'span',
        { class: 'brand__text' },
        el('strong', { text: 'Malolos' }),
        el('span', { class: 'brand__sub', text: 'Weather Monitor' })
      )
    ),
    nav,
    el('div', { class: 'masthead__tools' }, clock, el('div', { class: 'tool-cluster' }, unitToggle, themeToggle, account)),
    navToggle
  );

  return el('header', { class: 'masthead' }, bar);
}

function buildFooter() {
  return el(
    'div',
    { class: 'shell footer__inner' },
    el(
      'div',
      { class: 'footer__col' },
      el('p', { class: 'footer__lead', text: 'Malolos Weather Monitor' }),
      el('p', {
        class: 'footer__muted',
        text: 'A localized monitoring dashboard for Malolos, Bulacan. Not a substitute for official emergency warnings.',
      })
    ),
    el(
      'div',
      { class: 'footer__col' },
      el('p', { class: 'footer__label', text: 'Data' }),
      el('a', { class: 'footer__link', href: 'https://www.weatherapi.com/', target: '_blank', rel: 'noopener' }, 'WeatherAPI.com'),
      el('a', { class: 'footer__link', href: 'https://open-meteo.com/', target: '_blank', rel: 'noopener' }, 'Open-Meteo')
    ),
    el(
      'div',
      { class: 'footer__col' },
      el('p', { class: 'footer__label', text: 'Official authority' }),
      el(
        'a',
        { class: 'footer__link', href: 'https://www.pagasa.dost.gov.ph/', target: '_blank', rel: 'noopener' },
        'PAGASA',
        icon('external-link', 'footer__ext')
      )
    )
  );
}

let clockTimer = null;

function startClock() {
  const timeEl = qs('#station-clock-time');
  const dateEl = qs('#station-clock-date');
  if (!timeEl) return;
  const tick = () => {
    const now = new Date();
    timeEl.textContent = formatClock(now);
    dateEl.textContent = formatFullDate(now);
  };
  tick();
  clearInterval(clockTimer);
  clockTimer = setInterval(tick, 1000);
}

function wireNavDrawer(header) {
  const toggle = qs('.nav-toggle', header);
  const nav = qs('#primary-nav', header);
  if (!toggle || !nav) return;
  const setOpen = (open) => {
    header.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
}

/** Fill the masthead station readout with the real default-location metadata. */
async function fillStation() {
  try {
    const { default: loc } = await apiGet('/location');
    const clock = qs('.station-clock');
    if (clock && loc) {
      clock.setAttribute(
        'title',
        `${loc.name} station · ${coordsText(loc.lat, loc.lon)} · Philippine time`
      );
    }
  } catch {
    /* station title is a nicety; ignore failures */
  }
}

export function initChrome() {
  const activeKey = document.body.dataset.page || '';
  const headerHost = qs('#site-header');
  const footerHost = qs('#site-footer');

  if (headerHost) {
    const header = buildMasthead(activeKey);
    headerHost.replaceWith(header);
    renderIcons();
    bindThemeToggle(qs('#theme-toggle', header));
    bindUnitToggle(qs('#unit-toggle', header));
    wireNavDrawer(header);
    startClock();
    fillStation();
    mountAccount(qs('#account-slot', header));
  }

  if (footerHost) {
    footerHost.append(buildFooter());
    renderIcons();
  }
}
