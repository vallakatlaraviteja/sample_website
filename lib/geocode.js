// Real geocoding. Replaces hash-derived fake coordinates.
// Pipeline:
//   1. Fetch GitHub user.location (free-text).
//   2. Geocode via Nominatim (OSM) - free, requires UA + 1 req/s.
//   3. Cache in gh_user_locations forever.
// If location cannot be resolved, the repo is OMITTED from the globe rather than
// fabricated. That's the whole point of this fix.

const db = require('../db');

const GEOCODE_QUEUE = [];
let geocodingActive = false;
const memoryCache = new Map();

async function getCached(login) {
  const lo = login.toLowerCase();
  if (memoryCache.has(lo)) return memoryCache.get(lo);
  if (!db.pool) return null;
  try {
    const { rows } = await db.pool.query(
      `SELECT login, location, lat, lng FROM gh_user_locations WHERE login = $1`,
      [lo]
    );
    if (rows[0]) {
      memoryCache.set(lo, rows[0]);
      return rows[0];
    }
  } catch (err) { /* ignore */ }
  return null;
}

async function setCached(row) {
  memoryCache.set(row.login.toLowerCase(), row);
  if (!db.pool) return;
  try {
    await db.pool.query(
      `INSERT INTO gh_user_locations (login, location, lat, lng)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (login) DO UPDATE
         SET location = EXCLUDED.location,
             lat = EXCLUDED.lat,
             lng = EXCLUDED.lng,
             fetched_at = NOW()`,
      [row.login.toLowerCase(), row.location, row.lat, row.lng]
    );
  } catch (err) { /* ignore */ }
}

async function fetchUserLocation(login) {
  const headers = { 'User-Agent': 'TerraPulse/2.0', Accept: 'application/vnd.github+json' };
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers });
  if (!res.ok) throw new Error(`gh user ${res.status}`);
  const j = await res.json();
  return j.location || null;
}

async function nominatimGeocode(query) {
  if (!query) return null;
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('q', query);
  u.searchParams.set('format', 'json');
  u.searchParams.set('limit', '1');
  const res = await fetch(u, { headers: { 'User-Agent': 'TerraPulse/2.0 (terrapulse alerts)' } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length) return null;
  return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
}

// Resolve immediately if cached, else schedule background fetch and return null.
// This keeps the request hot path fast and respects Nominatim 1 req/s.
async function resolveLogin(login) {
  if (!login) return null;
  const cached = await getCached(login);
  if (cached) {
    if (cached.lat == null) return null;
    return { lat: Number(cached.lat), lng: Number(cached.lng), location: cached.location };
  }
  scheduleGeocode(login);
  return null;
}

function scheduleGeocode(login) {
  if (GEOCODE_QUEUE.includes(login)) return;
  GEOCODE_QUEUE.push(login);
  if (!geocodingActive) drainQueue();
}

async function drainQueue() {
  geocodingActive = true;
  while (GEOCODE_QUEUE.length) {
    const login = GEOCODE_QUEUE.shift();
    try {
      const cached = await getCached(login);
      if (cached) continue;
      let loc = null;
      try {
        loc = await fetchUserLocation(login);
      } catch (err) {
        // GitHub rate limit or 404 - cache as null to avoid retries
        await setCached({ login, location: null, lat: null, lng: null });
        continue;
      }
      let coords = null;
      if (loc) {
        try {
          coords = await nominatimGeocode(loc);
        } catch (err) {
          // Nominatim failure - cache the location text, no coords. Try again later? No, don't retry constantly.
        }
      }
      await setCached({
        login,
        location: loc,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
      // Respect Nominatim 1 req/s limit.
      await new Promise((r) => setTimeout(r, 1100));
    } catch (err) {
      console.warn('[geocode] queue err:', err.message);
    }
  }
  geocodingActive = false;
}

// Bulk: locate an array of repos (each having .owner). Returns repos that have coords.
async function locateRepos(repos) {
  const out = [];
  for (const r of repos) {
    const owner = r.owner || r.owner_login || (r.owner && r.owner.login);
    const ownerName = typeof owner === 'string' ? owner : owner?.login;
    if (!ownerName) continue;
    const loc = await resolveLogin(ownerName);
    if (loc) {
      out.push({ ...r, lat: loc.lat, lng: loc.lng, ownerLocation: loc.location });
    }
  }
  return out;
}

module.exports = { resolveLogin, locateRepos, scheduleGeocode };
