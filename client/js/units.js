/**
 * Temperature-unit preference (°C default, °F opt-in). Pure client-side
 * conversion — the API always speaks Celsius. Persisted to localStorage so it
 * sticks for logged-out visitors; auth.js mirrors it to the account when signed
 * in. Emits 'unitchange' so every controller can re-render its temperatures.
 */

const KEY = 'mwm-unit';

let current = read();

function read() {
  try {
    return localStorage.getItem(KEY) === 'f' ? 'f' : 'c';
  } catch {
    return 'c';
  }
}

export const getUnit = () => current;

export function setUnit(unit, { persist = true } = {}) {
  if (unit !== 'c' && unit !== 'f') return;
  current = unit;
  if (persist) {
    try {
      localStorage.setItem(KEY, unit);
    } catch {
      /* storage blocked */
    }
  }
  document.dispatchEvent(new CustomEvent('unitchange', { detail: { unit } }));
}

export const toggleUnit = () => setUnit(current === 'c' ? 'f' : 'c');

/** Wire a two-state °C/°F control; keeps its active state in sync. */
export function bindUnitToggle(button) {
  const sync = () => {
    button.dataset.unit = current;
    button.setAttribute('aria-label', current === 'c' ? 'Show temperatures in Fahrenheit' : 'Show temperatures in Celsius');
  };
  button.addEventListener('click', () => {
    toggleUnit();
    sync();
  });
  document.addEventListener('unitchange', sync);
  sync();
}
