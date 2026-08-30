/*
 * Blocking, non-module head script: applies the saved (or system) theme to
 * <html> BEFORE first paint so there is no light/dark flash. Kept dependency-
 * free and tiny on purpose. The richer toggle logic lives in js/theme.js.
 */
(function () {
  try {
    var stored = localStorage.getItem('mwm-theme');
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
