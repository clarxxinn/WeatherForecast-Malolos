-- ---------------------------------------------------------------------------
-- Malolos Weather Monitor — PostgreSQL schema
-- Idempotent: safe to run repeatedly (CREATE ... IF NOT EXISTS).
-- Applied by `npm run db:migrate` (server/database/migrate.js).
--
-- The whole app runs WITHOUT a database; these tables only power the optional
-- features: persisted observations, stored official alerts, user accounts, and
-- preferences. Column names here are the contract the models in
-- server/models/*.model.js query against — keep them in sync.
-- ---------------------------------------------------------------------------

-- Canonical locations. Mirrors server/config/locations.js so weather_records /
-- weather_alerts can foreign-key a real row. ensure() upserts on the natural key.
CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  province    TEXT,
  country     TEXT,
  latitude    NUMERIC(8,5) NOT NULL,
  longitude   NUMERIC(8,5) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, province, country)
);

-- User accounts. token_version is bumped to revoke all outstanding JWTs.
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  token_version  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Persisted current-conditions snapshots. UNIQUE(location_id, recorded_at) +
-- ON CONFLICT DO NOTHING makes repeated writes within the same minute harmless.
CREATE TABLE IF NOT EXISTS weather_records (
  id                BIGSERIAL PRIMARY KEY,
  location_id       INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  temperature       NUMERIC,
  feels_like        NUMERIC,
  humidity          INT,
  pressure          NUMERIC,
  wind_speed        NUMERIC,
  wind_direction    TEXT,
  rain_probability  INT,
  precipitation     NUMERIC,
  visibility        NUMERIC,
  uv_index          NUMERIC,
  weather_condition TEXT,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, recorded_at)
);
CREATE INDEX IF NOT EXISTS idx_wr_location_time
  ON weather_records (location_id, recorded_at DESC);

-- Stored OFFICIAL alerts only (from WeatherAPI). A stable fingerprint dedupes
-- repeat ingestions. Forecast-derived advisories are live-only, never stored.
CREATE TABLE IF NOT EXISTS weather_alerts (
  id           BIGSERIAL PRIMARY KEY,
  location_id  INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  severity     TEXT,
  source       TEXT,
  issued_at    TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  fingerprint  TEXT UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_location_time
  ON weather_alerts (location_id, issued_at DESC);

-- One preferences row per user (UNIQUE user_id), created/updated via UPSERT.
CREATE TABLE IF NOT EXISTS user_preferences (
  id                    SERIAL PRIMARY KEY,
  user_id               INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  temperature_unit      TEXT NOT NULL DEFAULT 'c',
  notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  default_location_id   INT REFERENCES locations(id) ON DELETE SET NULL,
  theme                 TEXT NOT NULL DEFAULT 'light'
);
