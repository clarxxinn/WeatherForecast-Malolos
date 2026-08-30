/**
 * Optional accounts. Everything here is progressive: if the server has no
 * database, /api/auth/* returns 503 and mountAccount() removes the account UI
 * entirely — the weather app is fully usable logged-out. When accounts exist,
 * the masthead's unit + theme controls double as preferences and sync to the
 * account, so there's no separate settings screen.
 */

import { apiGet, apiPost, apiPut, ApiError } from './api.js';
import { el, icon, qs, mount, renderIcons, toast } from './ui.js';
import { setTheme, getTheme } from './theme.js';
import { setUnit, getUnit } from './units.js';

let currentUser = null;
let slotEl = null;
let applyingPrefs = false; // guards the prefs->control->prefs echo
let saveTimer = null;

export async function mountAccount(slot) {
  slotEl = slot;
  if (!slot) return;
  try {
    const { user } = await apiGet('/auth/me');
    currentUser = user;
    renderSignedIn();
    loadAndApplyPrefs();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.code === 'NO_SESSION')) {
      renderSignedOut(); // DB is up, just not signed in
    } else {
      slot.remove(); // accounts unavailable (no DB / offline) — stay out of the way
      slotEl = null;
    }
  }
  document.addEventListener('unitchange', queuePrefSave);
  document.addEventListener('themechange', queuePrefSave);
}

function renderSignedOut() {
  if (!slotEl) return;
  mount(
    slotEl,
    el(
      'button',
      { class: 'btn btn--ghost btn--sm', type: 'button', onClick: openAuthModal },
      icon('log-in'),
      el('span', { text: 'Sign in' })
    )
  );
}

function renderSignedIn() {
  if (!slotEl || !currentUser) return;
  const initial = (currentUser.name || '?').trim().charAt(0).toUpperCase();
  const menu = el(
    'div',
    { class: 'account__menu', hidden: true, role: 'menu' },
    el('p', { class: 'account__who' }, el('strong', { text: currentUser.name }), el('span', { text: currentUser.email })),
    el('p', { class: 'account__hint', text: 'Your unit and theme choices are saved to this account.' }),
    el('button', { class: 'btn btn--ghost btn--block', type: 'button', role: 'menuitem', onClick: signOut }, icon('log-out'), el('span', { text: 'Sign out' }))
  );
  const trigger = el(
    'button',
    { class: 'account__trigger', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
    el('span', { class: 'account__avatar', text: initial }),
    el('span', { class: 'account__name', text: currentUser.name.split(' ')[0] }),
    icon('chevron-down', 'account__caret')
  );
  trigger.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden');
    menu.toggleAttribute('hidden', !open);
    trigger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account')) {
      menu.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
  mount(slotEl, trigger, menu);
}

async function signOut() {
  try {
    await apiPost('/auth/logout');
  } catch {
    /* ignore; clear locally regardless */
  }
  currentUser = null;
  renderSignedOut();
  toast('Signed out.', 'info');
}

// --- Preferences sync ------------------------------------------------------

async function loadAndApplyPrefs() {
  try {
    const { preferences } = await apiGet('/user/preferences');
    applyingPrefs = true;
    if (preferences.theme) setTheme(preferences.theme);
    if (preferences.temperatureUnit) setUnit(preferences.temperatureUnit);
  } catch {
    /* non-fatal */
  } finally {
    applyingPrefs = false;
  }
}

function queuePrefSave() {
  if (!currentUser || applyingPrefs) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await apiPut('/user/preferences', { temperatureUnit: getUnit(), theme: getTheme() });
    } catch {
      /* preference persistence is best-effort */
    }
  }, 600);
}

// --- Auth modal ------------------------------------------------------------

let lastFocused = null;

function openAuthModal() {
  lastFocused = document.activeElement;
  const backdrop = el('div', { class: 'modal-backdrop' });
  const form = buildAuthForm(() => close());
  const dialog = el(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Account access' },
    el(
      'button',
      { class: 'icon-btn modal__close', type: 'button', 'aria-label': 'Close', onClick: () => close() },
      icon('x')
    ),
    form
  );
  backdrop.append(dialog);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  document.body.classList.add('modal-open');
  renderIcons();
  requestAnimationFrame(() => backdrop.classList.add('modal-backdrop--in'));
  qs('input', dialog)?.focus();

  function close() {
    document.removeEventListener('keydown', onKey);
    backdrop.classList.remove('modal-backdrop--in');
    setTimeout(() => backdrop.remove(), 200);
    document.body.classList.remove('modal-open');
    lastFocused?.focus?.();
  }
}

function buildAuthForm(onDone) {
  let mode = 'login'; // 'login' | 'register'
  const title = el('h2', { class: 'modal__title', text: 'Sign in' });
  const subtitle = el('p', { class: 'modal__sub', text: 'Save your unit and theme across devices.' });
  const nameField = field('name', 'Name', 'text', 'name');
  const emailField = field('email', 'Email', 'email', 'email');
  const passwordField = field('password', 'Password', 'password', 'current-password');
  const errorBox = el('p', { class: 'form__error', role: 'alert', hidden: true });
  const submit = el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, el('span', { text: 'Sign in' }));
  const switcher = el('button', { class: 'link-btn', type: 'button' }, 'New here? Create an account');

  const setMode = (next) => {
    mode = next;
    const login = mode === 'login';
    title.textContent = login ? 'Sign in' : 'Create account';
    nameField.wrap.hidden = login;
    passwordField.input.setAttribute('autocomplete', login ? 'current-password' : 'new-password');
    submit.querySelector('span').textContent = login ? 'Sign in' : 'Create account';
    switcher.textContent = login ? 'New here? Create an account' : 'Have an account? Sign in';
    errorBox.hidden = true;
  };
  switcher.addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));

  const form = el(
    'form',
    { class: 'form', novalidate: true },
    title,
    subtitle,
    nameField.wrap,
    emailField.wrap,
    passwordField.wrap,
    errorBox,
    submit,
    switcher
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    submit.disabled = true;
    const payload = {
      email: emailField.input.value.trim(),
      password: passwordField.input.value,
      ...(mode === 'register' ? { name: nameField.input.value.trim() } : {}),
    };
    try {
      const { user } = await apiPost(mode === 'login' ? '/auth/login' : '/auth/register', payload);
      currentUser = user;
      renderSignedIn();
      loadAndApplyPrefs();
      toast(mode === 'login' ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Account created.', 'success');
      onDone();
    } catch (err) {
      errorBox.textContent = err?.message || 'Something went wrong. Try again.';
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  setMode('login');
  return form;
}

function field(name, label, type, autocomplete) {
  const input = el('input', {
    class: 'form__input',
    id: `f-${name}`,
    name,
    type,
    autocomplete,
    required: true,
  });
  const wrap = el(
    'label',
    { class: 'form__field', for: `f-${name}` },
    el('span', { class: 'form__label', text: label }),
    input
  );
  return { wrap, input };
}
