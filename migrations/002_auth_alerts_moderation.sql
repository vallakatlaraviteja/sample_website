-- Migration 002: auth, moderation, alerts, location cache.

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    github_id   BIGINT UNIQUE NOT NULL,
    login       TEXT NOT NULL,
    email       TEXT,
    avatar_url  TEXT,
    location    TEXT,
    is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_customer_id TEXT,
    stripe_sub_id      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_login_idx ON users (login);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Pulses: extend with auth + moderation status.
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected'));
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS verified     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS reviewer_id  INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;
ALTER TABLE pulses ADD COLUMN IF NOT EXISTS reject_reason TEXT;
CREATE INDEX IF NOT EXISTS pulses_status_idx ON pulses (status);

-- Email-alert subscriptions.
CREATE TABLE IF NOT EXISTS alerts (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('ai_launch','quake','category')),
    config      JSONB NOT NULL DEFAULT '{}'::jsonb,
    email       TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    last_sent_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS alerts_user_idx ON alerts (user_id);
CREATE INDEX IF NOT EXISTS alerts_kind_idx ON alerts (kind);

-- Real GitHub-user location cache (replaces hash-derived fake coords).
CREATE TABLE IF NOT EXISTS gh_user_locations (
    login       TEXT PRIMARY KEY,
    location    TEXT,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Moderation audit log.
CREATE TABLE IF NOT EXISTS mod_log (
    id          SERIAL PRIMARY KEY,
    pulse_id    INTEGER NOT NULL REFERENCES pulses(id) ON DELETE CASCADE,
    moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL CHECK (action IN ('approve','reject','flag')),
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tracking which AI launches we've already emailed about so digests don't repeat.
CREATE TABLE IF NOT EXISTS ai_launch_seen (
    repo_id     BIGINT PRIMARY KEY,
    full_name   TEXT NOT NULL,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
