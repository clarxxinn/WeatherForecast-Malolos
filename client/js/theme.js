/**
 * Theme toggle. The initial theme is already applied by theme-init.js (in <head>
 * before paint); this module handles the toggle button, persistence, and a
 * 'themechange' event that theme-aware widgets (charts) listen for to recolor.
 * When signed in, auth.js mirrors the choice to the account via setTheme().
 */

const KEY = 'mwm-theme';

export const getTheme = () => document.documentElement.getAttribute('data-theme') || 'light';

export function setTheme(theme, { persist = true } = {}) {
  if (theme !== 'light' && theme !== 'dark') return;
  document.documentElement.setAttribute('data-theme', theme);
  if (persist) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage blocked; in-memory only */
    }
  }
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');

/** Wire a toggle button: reflects state on aria-pressed and the icon. */
export function bindThemeToggle(button) {
  const sync = () => {
    const dark = getTheme() === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.dataset.theme = getTheme();
  };
  button.addEventListener('click', () => {
    toggleTheme();
    sync();
  });
  document.addEventListener('themechange', sync);
  sync();
}

/** CSS custom property value from the current theme (for canvas charts). */
export const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
