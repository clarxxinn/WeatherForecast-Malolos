/**
 * Alerts controller. Renders official warnings and forecast-derived advisories
 * into their own sections, keeping them visually distinct. The PAGASA card in
 * the page is always present regardless of fetch state, so the official channel
 * is reachable even if this request fails.
 */

import { initChrome } from '../nav.js';
import { apiGet } from '../api.js';
import { qs, mount, el, errorState, emptyState } from '../ui.js';
import { alertCard } from '../render.js';

initChrome();

function skel(host, n) {
  mount(host, el('div', { class: 'skeleton-list' }, Array.from({ length: n }, () => el('div', { class: 'skeleton' }))));
}

async function load() {
  const officialHost = qs('#official');
  const derivedHost = qs('#derived');
  skel(officialHost, 2);
  skel(derivedHost, 3);
  try {
    const { official = [], derived = [] } = await apiGet('/alerts');

    if (official.length) {
      mount(officialHost, el('div', { class: 'alert-stack' }, official.map((a) => alertCard(a, { derived: false }))));
    } else {
      mount(officialHost, emptyState('No official warnings are in effect for Malolos right now.', 'shield-check'));
    }

    if (derived.length) {
      mount(derivedHost, el('div', { class: 'alert-stack' }, derived.map((a) => alertCard(a, { derived: true }))));
    } else {
      mount(derivedHost, emptyState('Nothing notable in the current forecast.', 'circle-check'));
    }
  } catch (err) {
    mount(officialHost, errorState(err, load));
    mount(derivedHost, el('span'));
  }
}

load();
