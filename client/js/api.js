/**
 * The one place the client performs network I/O. Wraps fetch, unwraps the server
 * envelope ({success,data} | {success,error}), and throws a typed ApiError so
 * callers can branch on `.code` (e.g. WEATHER_API_KEY_MISSING, DB_DISABLED) and
 * `.status`. Sends X-Requested-With on every request — GETs ignore it, mutating
 * routes require it (the server's CSRF defense).
 */

import { CONFIG } from './config.js';

export class ApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code || null;
    this.status = status || null;
  }
}

async function request(method, path, { body, signal } = {}) {
  const url = path.startsWith('http') ? path : CONFIG.apiBase + path;

  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      signal,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Can’t reach the server. Check your connection, then retry.', {
      code: 'NETWORK',
    });
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* empty/non-JSON body handled below */
  }

  if (!res.ok || !payload || payload.success === false) {
    throw new ApiError(payload?.error?.message || 'Something went wrong while loading data.', {
      code: payload?.error?.code,
      status: res.status,
    });
  }
  return payload.data;
}

export const apiGet = (path, opts) => request('GET', path, opts);
export const apiPost = (path, body) => request('POST', path, { body });
export const apiPut = (path, body) => request('PUT', path, { body });

/** Append ?location=<slug> (and any extra params) to an API path. */
export function withParams(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}
