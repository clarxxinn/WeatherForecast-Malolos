/**
 * DOM + state-display toolkit shared by every page controller. Centralizes the
 * three states each data section can be in — skeleton (loading), error+retry,
 * and content — so the whole app handles slow networks and API/DB outages the
 * same way and never shows a broken half-loaded card.
 */

/** Terse createElement: el('div', {class:'x', onClick:fn}, child, 'text'). */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  appendAll(node, children);
  return node;
}

function appendAll(node, children) {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** A Lucide icon placeholder; call renderIcons() after it's in the DOM. */
export const icon = (name, cls = '') =>
  el('i', { 'data-lucide': name, class: cls || false, 'aria-hidden': 'true' });

/** Swap the SVG in for every [data-lucide] currently on the page. Idempotent. */
export function renderIcons() {
  try {
    window.lucide?.createIcons();
  } catch {
    /* icon lib not ready yet; a later call will catch up */
  }
}

/** Replace a container's contents with one node (or nodes), then paint icons. */
export function mount(container, ...nodes) {
  container.replaceChildren(...nodes.flat().filter(Boolean));
  renderIcons();
}

// --- Skeletons -------------------------------------------------------------

export const shimmer = (cls = '') =>
  el('div', { class: `skeleton ${cls}`.trim(), 'aria-hidden': 'true' });

/** N shimmer blocks in a wrapper, e.g. skeletons(6, 'metric-grid', 'metric-card'). */
export function skeletons(count, wrapCls, itemCls = '') {
  return el(
    'div',
    { class: wrapCls, 'aria-hidden': 'true' },
    Array.from({ length: count }, () => shimmer(itemCls))
  );
}

// --- States ----------------------------------------------------------------

/** Error card with an optional Retry button. Used on any failed fetch. */
export function errorState(err, onRetry) {
  const wrap = el(
    'div',
    { class: 'state state--error', role: 'alert' },
    icon('triangle-alert', 'state__icon'),
    el('p', { class: 'state__msg', text: err?.message || 'Couldn’t load this section.' })
  );
  if (onRetry) {
    wrap.append(
      el(
        'button',
        { class: 'btn btn--ghost btn--sm', type: 'button', onClick: onRetry },
        icon('rotate-cw'),
        el('span', { text: 'Retry' })
      )
    );
  }
  renderIcons();
  return wrap;
}

/** A calm, non-alarming notice — used when a feature just needs setup (no key). */
export function noticeState({ icon: name = 'info', title, message, action } = {}) {
  const wrap = el(
    'div',
    { class: 'state state--notice' },
    icon(name, 'state__icon'),
    title ? el('p', { class: 'state__title', text: title }) : null,
    message ? el('p', { class: 'state__msg', text: message }) : null,
    action || null
  );
  renderIcons();
  return wrap;
}

export function emptyState(message, name = 'inbox') {
  const wrap = el(
    'div',
    { class: 'state state--empty' },
    icon(name, 'state__icon'),
    el('p', { class: 'state__msg', text: message })
  );
  renderIcons();
  return wrap;
}

/**
 * The load-render-error loop for a section. Shows `skeleton`, awaits `load()`,
 * then hands the result to `render()`. On failure shows an error card whose
 * Retry re-runs the whole loop. AbortErrors (navigation/refresh races) are
 * swallowed silently.
 */
export async function loadInto(container, { skeleton, load, render }) {
  if (skeleton) mount(container, skeleton());
  try {
    const data = await load();
    render(data);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    mount(container, errorState(err, () => loadInto(container, { skeleton, load, render })));
  }
}

// --- Toast (auth + preference feedback) ------------------------------------

let toastHost = null;
export function toast(message, kind = 'info') {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const iconName = kind === 'error' ? 'circle-alert' : kind === 'success' ? 'circle-check' : 'info';
  const t = el('div', { class: `toast toast--${kind}` }, icon(iconName), el('span', { text: message }));
  toastHost.append(t);
  renderIcons();
  setTimeout(() => t.classList.add('toast--in'), 10);
  setTimeout(() => {
    t.classList.remove('toast--in');
    setTimeout(() => t.remove(), 300);
  }, 4200);
}
