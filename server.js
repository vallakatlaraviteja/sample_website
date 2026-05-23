// TerraPulse server.
// Single Node service: serves static frontend + JSON API.
// Aggressively caches third-party APIs to stay under free-tier limits.

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./db');

const PORT = process.env.PORT || 3000;
const app = express();

// --- Middleware -------------------------------------------------------------
app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false, // we load three.js / globe.gl from CDN
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 pulse submissions per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Simple TTL cache -------------------------------------------------------
const cache = new Map();
async function cached(key, ttlMs, fetcher) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.t < ttlMs) return hit.v;
  try {
    const v = await fetcher();
    cache.set(key, { t: now, v });
    return v;
  } catch (err) {
    if (hit) {
      console.warn(`[cache] ${key} fetch failed, serving stale:`, err.message);
      return hit.v;
    }
    throw err;
  }
}

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || 8000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TerraPulse/1.0' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- Health -----------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbHealth = await db.healthcheck();
  res.json({ status: 'ok', uptime: process.uptime(), ...dbHealth });
});

// --- Live signals -----------------------------------------------------------

// ISS current position
// wheretheiss.at over HTTPS. Previously used open-notify.org which is
// HTTP-only and has been intermittently dead for years. Cache 5s so
// rapid-polling clients don't blow through the upstream rate limit.
app.get('/api/signals/iss', async (req, res) => {
  try {
    const data = await cached('iss', 5_000, async () => {
      const j = await fetchJson('https://api.wheretheiss.at/v1/satellites/25544');
      return {
        lat: Number(j.latitude),
        lng: Number(j.longitude),
        altitudeKm: Number(j.altitude),
        velocityKmh: Number(j.velocity),
        timestamp: Number(j.timestamp) * 1000,
      };
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'iss_unavailable', detail: err.message });
  }
});

// Earthquakes (USGS, no key) - last 24h
app.get('/api/signals/quakes', async (req, res) => {
  try {
    const data = await cached('quakes', 60_000, async () => {
      const j = await fetchJson(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
      );
      return j.features.map((f) => ({
        id: f.id,
        mag: f.properties.mag,
        place: f.properties.place,
        time: f.properties.time,
        url: f.properties.url,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        depth: f.geometry.coordinates[2],
      }));
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'quakes_unavailable', detail: err.message });
  }
});

// Trending tech repos via GitHub search API (anonymous, low rate limit)
app.get('/api/signals/tech', async (req, res) => {
  try {
    const data = await cached('tech', 10 * 60_000, async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const j = await fetchJson(
        `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=20`
      );
      // Fake-locate by hashing owner login to a stable lat/lng so they
      // appear scattered. Real geo would need owner-location lookup.
      return (j.items || []).map((r) => {
        const h = hash(r.owner.login);
        const lat = ((h % 1600) / 10) - 80;       // -80..80
        const lng = (((h >> 4) % 3600) / 10) - 180; // -180..180
        return {
          id: r.id,
          name: r.full_name,
          description: r.description,
          stars: r.stargazers_count,
          language: r.language,
          url: r.html_url,
          owner: r.owner.login,
          ownerAvatar: r.owner.avatar_url,
          lat,
          lng,
        };
      });
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'tech_unavailable', detail: err.message });
  }
});

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

// --- User pulses (DB-backed) ------------------------------------------------
const ALLOWED_CATEGORIES = new Set([
  'tech', 'science', 'climate', 'space', 'health', 'culture', 'other',
]);

app.get('/api/pulses', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const items = await db.getPulses({ limit });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'pulses_failed', detail: err.message });
  }
});

app.post('/api/pulses', writeLimiter, async (req, res) => {
  const { title, description, category, lat, lng, url } = req.body || {};

  if (!title || typeof title !== 'string' || title.length > 140) {
    return res.status(400).json({ error: 'invalid_title' });
  }
  if (!category || !ALLOWED_CATEGORIES.has(category)) {
    return res.status(400).json({ error: 'invalid_category' });
  }
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || latN < -90 || latN > 90) {
    return res.status(400).json({ error: 'invalid_lat' });
  }
  if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) {
    return res.status(400).json({ error: 'invalid_lng' });
  }
  if (url && (typeof url !== 'string' || !/^https?:\/\//i.test(url))) {
    return res.status(400).json({ error: 'invalid_url' });
  }

  try {
    const item = await db.createPulse({
      title, description, category, lat: latN, lng: lngN, url,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'create_failed', detail: err.message });
  }
});

// --- Static frontend --------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  index: 'index.html',
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[terrapulse] listening on :${PORT} (${process.env.NODE_ENV || 'development'})`);
});
