/**
 * Map controller. Centers a Leaflet + OpenStreetMap view on the real station
 * coordinates from /api/location and marks it. If current conditions are
 * available, the marker popup is enriched with the live reading — but the map
 * works fully without a weather key. A vector marker (not an image) keeps the
 * brand mark crisp and avoids any CDN icon-path issues.
 */

import { initChrome } from '../nav.js';
import { apiGet } from '../api.js';
import { qs, el, icon, mount, renderIcons, noticeState } from '../ui.js';
import { cssVar } from '../theme.js';
import { coordsText, tempValue, relativeFromNow } from '../format.js';
import { conditionText } from '../icons.js';
import { getUnit } from '../units.js';

initChrome();

const host = qs('#weather-map');

async function boot() {
  if (typeof window.L === 'undefined') {
    mount(host, noticeState({ icon: 'map-pin-off', title: 'Map unavailable', message: 'The map library could not be loaded.' }));
    return;
  }

  let loc;
  try {
    const data = await apiGet('/location');
    loc = data.default;
  } catch (err) {
    mount(host, noticeState({ icon: 'map-pin-off', title: 'Location unavailable', message: err?.message || 'Could not load the station location.' }));
    return;
  }

  const L = window.L;
  const map = L.map(host, { scrollWheelZoom: false }).setView([loc.lat, loc.lon], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const marker = L.circleMarker([loc.lat, loc.lon], {
    radius: 9,
    color: cssVar('--ink') || '#0e1a24',
    weight: 2,
    fillColor: cssVar('--sun') || '#efb00d',
    fillOpacity: 1,
  }).addTo(map);

  marker.bindPopup(popupHtml(loc, null)).openPopup();

  const note = qs('#map-note');
  if (note) {
    note.replaceChildren(
      el('span', { text: `${loc.name} · ${coordsText(loc.lat, loc.lon)}` }),
      el('span', { class: 'dot', text: '·' }),
      el('span', { text: 'Base map © OpenStreetMap' })
    );
  }

  // Best-effort enrichment with the live reading.
  try {
    const { current, meta } = await apiGet('/weather');
    marker.setPopupContent(popupHtml(loc, { current, meta }));
  } catch {
    /* no key / offline — the station popup already stands on its own */
  }
}

function popupHtml(loc, weather) {
  const wrap = el(
    'div',
    { class: 'map-popup' },
    el('strong', { text: loc.name }),
    el('div', { class: 'mono', text: coordsText(loc.lat, loc.lon) })
  );
  if (weather?.current) {
    const unit = getUnit();
    wrap.append(
      el('div', { style: 'margin-top:6px', text: `${tempValue(weather.current.tempC, unit)}°${unit.toUpperCase()} · ${conditionText(weather.current.condition)}` }),
      el('div', { class: 'mono muted', text: `Updated ${relativeFromNow(weather.current.observedAtEpoch)}` })
    );
  }
  return wrap;
}

boot();
renderIcons();
