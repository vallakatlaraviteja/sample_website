-- TerraPulse schema
CREATE TABLE IF NOT EXISTS pulses (
    id           SERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT,
    category     TEXT NOT NULL,
    lat          DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng          DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    url          TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pulses_created_at_idx ON pulses (created_at DESC);
CREATE INDEX IF NOT EXISTS pulses_category_idx   ON pulses (category);
