# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Localized weather monitoring dashboard for Malolos, Bulacan, Philippines. Full-stack, two clean layers:

- **Backend** — Node 18+ / Express (CommonJS, `'use strict'` throughout) acting as a secure proxy + cache in front of two weather providers. The only tier that holds API keys or talks to a DB.
- **Frontend** — a vanilla multi-page app in [client/](client/): HTML5 + CSS + ES modules, **no build step, no framework**, served statically by the backend. It only ever calls our own `/api`.

**HARD RULE: no fabricated weather values.** Every number shown to a user must trace back to a live provider response. When data is unavailable (no key, upstream down), the UI shows a labeled notice — it must never invent, interpolate, or placeholder a reading. This rule shapes both the server's graceful degradation and the client's rendering.

## Commands

```bash
npm start          # node server/index.js
npm run dev        # nodemon (auto-reload)
npm test           # node --test (built-in Node test runner)
node --test path/to/file.test.js   # run a single test file

npm run db:migrate # apply server/database/schema.sql (needs DATABASE_URL)
npm run db:seed    # seed canonical locations (run AFTER migrate)
```

The frontend has **no build/bundle step** — edit files under [client/](client/) and reload. There is no linter/formatter configured despite the `eslint-disable` comments in the source.

## Current state / gotchas

- **The CSP in [server/app.js](server/app.js) is load-bearing.** It allowlists the exact CDN origins (jsdelivr for Chart.js, unpkg for Leaflet + Lucide, Google Fonts) and OSM tile hosts. Adding a CDN library or external resource without extending the CSP directives makes it silently fail to load and the affected section renders blank. `connectSrc` is `'self'` only — the client must never `fetch` anything but our own `/api`.
- **`server/app.js` serves `client/` and has a catch-all**: `/` and each page route send the matching HTML; any other non-API HTML `GET` falls back to `index.html`. So a bad in-app link degrades to the dashboard rather than a 404.
- **The database is optional and off by default.** With no `DATABASE_URL` the app runs fully (weather works; accounts/persistence are simply absent). To enable it: set `DATABASE_URL`, then `npm run db:migrate` (applies the idempotent [schema.sql](server/database/schema.sql)), then `npm run db:seed` (upserts the canonical locations). Both scripts exit non-zero if `DATABASE_URL` is unset.
- **No test files exist yet**, though `npm test` is wired to `node --test`. Good first targets are the pure functions in [normalize.js](server/services/normalize.js) and [advisories.service.js](server/services/advisories.service.js).

## Architecture

### Graceful degradation is the core design rule

The app must **boot and serve with no `WEATHER_API_KEY` and no `DATABASE_URL`**. This shapes everything:

- **No `WEATHER_API_KEY`** → current/hourly/official-alerts return a clear 503 (`WEATHER_API_KEY_MISSING`), but the 7-day daily forecast + history (Open-Meteo, keyless) + forecast-derived advisories + PAGASA links all still work.
- **No `DATABASE_URL`** → no accounts/preferences/persistence, but every weather feature works. The DB connectivity probe in [pool.js](server/database/pool.js) is async and **never blocks startup**; on a query failure it flips to unavailable and re-probes with exponential backoff, so a recovered DB is picked up automatically. `pg` is `require`d lazily so the dependency stays optional.

When adding a feature, preserve this: anything touching the DB or WeatherAPI must degrade, not crash.

### Two providers, one internal vocabulary

- [providers/weatherapi.provider.js](server/services/providers/weatherapi.provider.js) — current, hourly, official alerts, astronomy, AQI. **The only module that knows the API key.** Requires a key.
- [providers/openmeteo.provider.js](server/services/providers/openmeteo.provider.js) — extended daily forecast + historical data. Keyless.

Both normalize their upstream condition codes (WeatherAPI numeric codes / Open-Meteo WMO codes) into **one internal condition enum** in [normalize.js](server/services/normalize.js), so nothing downstream depends on a specific provider. Providers are also the only place upstream errors are mapped to `AppError` with client-safe messages — **upstream URLs and keys must never leak to clients**.

### Single cached bundle → ~1 upstream call per location per window

[weather.service.js](server/services/weather.service.js) fetches the WeatherAPI `/forecast.json` bundle **once per cache window** (key `wapi:bundle:<slug>`) and projects current/hourly/alerts from that same bundle. [cache.js](server/services/cache.js) is an in-memory TTL cache with a **single-flight guard** (concurrent callers for one key share a single in-flight promise). Per-process only — swap for Redis to scale horizontally.

### Three-tier alerts — keep official vs. derived strictly separate

[alerts.service.js](server/services/alerts.service.js) returns three clearly-labeled tiers:

1. `official[]` — real provider alerts (attributed to weatherapi.com).
2. `derived[]` — advisories **computed from real forecast values** in [advisories.service.js](server/services/advisories.service.js) using thresholds in [config/thresholds.js](server/config/thresholds.js). **These must always carry the "Forecast-derived, not an official warning" disclaimer and must never be presented as PAGASA warnings.**
3. `officialChannels[]` — always-present PAGASA links (the actual authority; never scraped, links only).

### Persistence is a side-effect, never a dependency

[persistence.service.js](server/services/persistence.service.js) writes observations/official alerts **fire-and-forget** when the DB is up. Every write is guarded so a DB failure can never delay or break a weather response — e.g. [weather.controller.js](server/controllers/weather.controller.js) calls `persistObservation(...)` without `await`. Dedupe relies on `recorded_at` rounded to the minute + `ON CONFLICT DO NOTHING`.

### Request lifecycle (weather endpoints)

`apiLimiter` → `validate(schema, 'query')` → `attachLocation` → controller → envelope.

- **Validation** ([middleware/validate.js](server/middleware/validate.js)) uses Zod schemas in [validators/index.js](server/validators/index.js). Query schemas use `z.coerce` (so `?hours=24` validates as a number) and `.default()`. Validated query is written to **`req.validatedQuery`**, not `req.query` (Express query is a read-only getter) — controllers read `req.validatedQuery`.
- **Location** ([middleware/resolveLocation.js](server/middleware/resolveLocation.js)) resolves `?location=<slug>` to `req.location`, defaulting to Malolos. An explicit but unknown slug is a 404. The location registry is [config/locations.js](server/config/locations.js); Malolos is hard-coded default and the structure supports adding more.

### Uniform response envelope + typed errors

- Every response goes through [utils/envelope.js](server/utils/envelope.js): success → `{ success: true, data }`, failure → `{ success: false, error: { message, code?, details? } }`.
- Controllers `try { ... } catch (err) { next(err) }` and throw `AppError` via the factories in [utils/httpError.js](server/utils/httpError.js) (`badRequest`, `unauthorized`, `notFound`, `upstream` (502), `unavailable` (503), …) with a stable machine `code`. [middleware/errorHandler.js](server/middleware/errorHandler.js) converts `AppError` to the envelope; anything else becomes a generic 500 with no internal leak.

### Auth (only active when DB is enabled)

- JWT in an httpOnly cookie (`mwm_token`); bcrypt password hashes; login failures are deliberately generic (no user-existence oracle).
- The JWT carries `token_version`; bumping `users.token_version` instantly revokes all existing sessions ([utils/token.js](server/utils/token.js), [auth.middleware.js](server/middleware/auth.middleware.js)).
- Mutating routes require an `X-Requested-With: XMLHttpRequest` header (CSRF defense-in-depth) plus a stricter `authLimiter`. Middleware order on such routes: `authLimiter` → `requireCsrfHeader` → `requireDb` → `validate` → controller.

### Config & conventions

- All env parsing is centralized in [config/index.js](server/config/index.js) into a single frozen `config` object; read config from there rather than `process.env`. `.env` lives at the project root (copy from [.env.example](.env.example)).
- **Timezone is always Asia/Manila.** Timestamps flow as epoch-milliseconds (Open-Meteo is queried with `timeformat=unixtime`); the frontend does the localized formatting.
- API routers are aggregated in [routes/index.js](server/routes/index.js) under `/api`: `health`, `location`, `weather`, `forecast`, `alerts`, `history`, `auth`, `user`. `/api/health` reports env, DB status (`disabled`/`up`/`down`), WeatherAPI status, and cache stats.

### Frontend (client/) — vanilla ES modules mirroring the server contract

No framework, no bundler. Each HTML page loads **one** page controller from [client/js/pages/](client/js/pages/) as `<script type="module">`; `<body data-page="…">` drives the active nav state. CDN libs (Chart.js, Leaflet, Lucide) load `defer` *before* the module, and controllers guard on `window.Chart` / `window.L` so a blocked/missing CDN degrades to a notice instead of a crash.

- **One network chokepoint — [client/js/api.js](client/js/api.js).** All I/O goes through `apiGet`/`apiPost`/`apiPut`, which unwrap the envelope and return `payload.data`, or throw an `ApiError` carrying the server's machine `.code` + HTTP `.status`. It sends `X-Requested-With: XMLHttpRequest` (matching the server's CSRF check). This is why controllers can branch on `err.code === 'WEATHER_API_KEY_MISSING'` to show the right notice.
- **Client degradation mirrors the server (the HARD RULE at render time).** A key-gated 503 → a labeled "not configured" notice, never a fabricated value; keyless data (daily forecast, history, derived advisories) still renders. The dashboard hero, for example, falls back live → today's forecast (clearly relabeled) → notice.
- **Shared chrome — [nav.js](client/js/nav.js) `initChrome()`.** Every page controller calls it first; it builds the masthead/footer into `#site-header`/`#site-footer`, runs the Asia/Manila clock, wires the theme + unit toggles and nav drawer, and mounts the account UI ([auth.js](client/js/auth.js) `mountAccount`, progressive — signed-out unless a session exists).
- **Theme + units are event-driven.** `[data-theme]` lives on `<html>`; [theme-init.js](client/js/theme-init.js) is a deliberate **classic script** (not a module) loaded blocking in `<head>` to set the theme before first paint — the CSP forbids inline scripts, so it must be its own file. Toggling dispatches `themechange` / `unitchange`; [charts.js](client/js/charts.js) keeps a registry and rebuilds every live chart on those events, reading colors from CSS custom properties (`cssVar`) so a theme flip recolors Chart.js and Leaflet too.
- **Module roles:** [render.js](client/js/render.js) = shared DOM fragments (hourly strip, daily rows, metric/alert cards); [charts.js](client/js/charts.js) = all Chart.js instances + register/destroy/refresh registry; [ui.js](client/js/ui.js) = DOM helpers + skeleton/error/notice/empty states; [icons.js](client/js/icons.js) = internal condition enum → Lucide glyph, sky class, label; [format.js](client/js/format.js) = all Asia/Manila formatting (epoch-**ms** in, localized strings out).
- **Keep the vocabularies in sync:** [client/js/config.js](client/js/config.js) `CONDITIONS` mirrors the server's condition enum in [normalize.js](server/services/normalize.js). CSS is split by concern and **load order matters** ([themes.css](client/css/themes.css) tokens → [style.css](client/css/style.css) components → [weather-bg.css](client/css/weather-bg.css) living-sky hero → [responsive.css](client/css/responsive.css)).
