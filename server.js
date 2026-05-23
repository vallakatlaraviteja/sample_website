// TerraPulse server v2.
// - Auth (GitHub OAuth)
// - Moderation queue + admin endpoints
// - Real geocoding for AI repos (no fake hash coords)
// - Self-hosted globe textures (with CDN fallback)
// - Stripe checkout for $5/mo Verified tier
// - Email-alert subscriptions

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const auth = require('./lib/auth');
const moderation = require('./lib/moderation');
const billing = require('./lib/billing');
const { fetchRecentAIRepos } = require('./lib/ai_launches');
const { locateRepos, scheduleGeocode } = require('./lib/geocode');

const PORT = process.env.PORT || 3000;
const APP_MODE = process.env.APP_MODE || 'ai';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const app = express();
app.set('trust proxy', 1);

// Stripe webhook needs raw body BEFORE json parser. Mount it first.
app.post('/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const r = await billing.handleWebhook(req, req.body);
    if (!r.ok) return res.status(400).json({ error: r.reason || 'webhook_failed' });
    res.json({ ok: true });
  }
);

// CSP allows our inlined globe.gl/three from CDN AND self-hosted textures.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", 'https://unpkg.com'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https://unpkg.com', 'https://avatars.githubusercontent.com'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(auth.attachUser);

const writeLimiter = rateLimit({ windowMs: 60_000, max: 8, standardHeaders: true });
const authLimiter  = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true });

// --- TTL cache --------------------------------------------------------------
const cache = new Map();
async function cached(key, ttlMs, fetcher) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  try {
    const v = await fetcher();
    cache.set(key, { t: Date.now(), v });
    return v;
  } catch (err) {
    if (hit) return hit.v;
    throw err;
  }
}

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || 8000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TerraPulse/2.0', ...(opts.headers || {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- Health + config --------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbHealth = await db.healthcheck();
  res.json({ status: 'ok', uptime: process.uptime(), ...dbHealth });
});

app.get('/api/config', (req, res) => {
  res.json({
    appMode: APP_MODE,
    authEnabled: auth.isAuthEnabled(),
    billingEnabled: billing.isEnabled(),
    user: req.user ? {
      id: req.user.id,
      login: req.user.login,
      avatar: req.user.avatar_url,
      email: req.user.email,
      isAdmin: req.user.is_admin,
      isVerified: req.user.is_verified,
    } : null,
  });
});

// --- OAuth ------------------------------------------------------------------
const oauthStates = new Map(); // state -> expires
function stashState() {
  const s = crypto.randomBytes(16).toString('hex');
  oauthStates.set(s, Date.now() + 10 * 60_000);
  return s;
}
function consumeState(s) {
  const exp = oauthStates.get(s);
  oauthStates.delete(s);
  return exp && exp > Date.now();
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of oauthStates) if (v < now) oauthStates.delete(k);
}, 5 * 60_000).unref();

app.get('/api/auth/github/start', authLimiter, (req, res) => {
  if (!auth.isAuthEnabled()) return res.status(503).json({ error: 'auth_disabled' });
  const state = stashState();
  res.redirect(auth.startUrl(state));
});

app.get('/api/auth/github/callback', authLimiter, async (req, res) => {
  if (!auth.isAuthEnabled()) return res.status(503).send('auth disabled');
  const { code, state } = req.query;
  if (!code || !state || !consumeState(String(state))) return res.status(400).send('bad state');
  try {
    const accessToken = await auth.exchangeCode(String(code));
    const profile = await auth.fetchGithubUser(accessToken);
    const user = await auth.upsertUser(profile);
    const sess = await auth.createSession(user.id);
    auth.setSessionCookie(res, sess.token, sess.expires);
    // Pre-warm location cache for the user's own login (cheap and useful).
    if (user.login) scheduleGeocode(user.login);
    res.redirect('/');
  } catch (err) {
    console.error('[auth] callback err:', err.message);
    res.status(500).send('auth failed');
  }
});

app.post('/api/auth/logout', authLimiter, async (req, res) => {
  await auth.destroySession(req.sessionToken);
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

// --- Live signals -----------------------------------------------------------
app.get('/api/signals/iss', async (req, res) => {
  try {
    const data = await cached('iss', 5_000, async () => {
      // open-notify is HTTP-only and flaky; wsf.spotthestation.nasa.gov has no JSON API.
      // Use wheretheiss.at - HTTPS, JSON, no key.
      const j = await fetchJson('https://api.wheretheiss.at/v1/satellites/25544');
      return { lat: Number(j.latitude), lng: Number(j.longitude), timestamp: j.timestamp * 1000 };
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'iss_unavailable', detail: err.message });
  }
});

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

// AI launches: real GitHub repos with REAL geocoded owner locations.
// Repos whose owners we can't locate are omitted (no fabricated coords).
app.get('/api/signals/ai_launches', async (req, res) => {
  try {
    const data = await cached('ai_launches', 10 * 60_000, async () => {
      const repos = await fetchRecentAIRepos({ daysBack: 7, minStars: 30, perPage: 50 });
      const located = await locateRepos(repos);
      // Schedule geocoding for the un-located ones so they appear next time.
      const locatedIds = new Set(located.map((r) => r.id));
      for (const r of repos) {
        if (!locatedIds.has(r.id)) scheduleGeocode(r.owner);
      }
      return {
        located,
        pending: repos.length - located.length,
        total: repos.length,
      };
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'ai_unavailable', detail: err.message });
  }
});

// --- Pulses (read) ----------------------------------------------------------
app.get('/api/pulses', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const items = await db.getPulses({ limit, status: 'approved' });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'pulses_failed', detail: err.message });
  }
});

// --- Pulses (create) --------------------------------------------------------
const ALLOWED_CATEGORIES = new Set([
  'ai_launch', 'tech', 'science', 'climate', 'space', 'health', 'culture', 'other',
]);

app.post('/api/pulses', writeLimiter, async (req, res) => {
  // If auth is enabled, require login. If not enabled (dev), allow anonymous
  // but mark pending.
  if (auth.isAuthEnabled() && !req.user) {
    return res.status(401).json({ error: 'auth_required' });
  }

  const { title, description, category, lat, lng, url } = req.body || {};
  if (!title || typeof title !== 'string' || title.length > 140) return res.status(400).json({ error: 'invalid_title' });
  if (!category || !ALLOWED_CATEGORIES.has(category)) return res.status(400).json({ error: 'invalid_category' });
  const latN = Number(lat), lngN = Number(lng);
  if (!Number.isFinite(latN) || latN < -90 || latN > 90) return res.status(400).json({ error: 'invalid_lat' });
  if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) return res.status(400).json({ error: 'invalid_lng' });

  const isVerified = Boolean(req.user?.is_verified);
  const verdict = moderation.evaluate({ title, description, url, isVerified });
  if (!verdict.allow) {
    return res.status(400).json({ error: 'rejected', reasons: verdict.reasons });
  }

  try {
    const item = await db.createPulse({
      title, description, category, lat: latN, lng: lngN, url,
      userId: req.user?.id || null,
      status: verdict.autoApprove ? 'approved' : 'pending',
      verified: isVerified,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'create_failed', detail: err.message });
  }
});

// --- Moderation queue (admin only) ------------------------------------------
app.get('/api/admin/pending', auth.requireAdmin, async (req, res) => {
  const items = await db.getPendingPulses({ limit: 200 });
  res.json(items);
});

app.post('/api/admin/pulses/:id/decision', auth.requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { action, reason } = req.body || {};
  if (!Number.isFinite(id) || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  try {
    await db.moderatePulse({ pulseId: id, action, moderatorId: req.user.id, reason });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'mod_failed', detail: err.message });
  }
});

// --- Alerts -----------------------------------------------------------------
app.get('/api/alerts', auth.requireUser, async (req, res) => {
  const items = await db.getUserAlerts(req.user.id);
  res.json(items);
});

app.post('/api/alerts', auth.requireUser, async (req, res) => {
  const { kind, config, email } = req.body || {};
  if (!['ai_launch', 'quake', 'category'].includes(kind)) {
    return res.status(400).json({ error: 'invalid_kind' });
  }
  const targetEmail = email || req.user.email;
  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  // Free tier: at most 3 alerts per user. Verified: 25.
  const existing = await db.getUserAlerts(req.user.id);
  const cap = req.user.is_verified ? 25 : 3;
  if (existing.length >= cap) return res.status(402).json({ error: 'alert_cap', cap });

  const alert = await db.createAlert({
    userId: req.user.id, kind, config: config || {}, email: targetEmail,
  });
  res.status(201).json(alert);
});

app.delete('/api/alerts/:id', auth.requireUser, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid_id' });
  await db.deleteAlert(req.user.id, id);
  res.json({ ok: true });
});

// --- Billing ----------------------------------------------------------------
app.post('/api/billing/checkout', auth.requireUser, async (req, res) => {
  if (!billing.isEnabled()) return res.status(503).json({ error: 'billing_disabled' });
  try {
    const url = await billing.createCheckoutSession(req.user);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'checkout_failed', detail: err.message });
  }
});

// --- Static -----------------------------------------------------------------
const STATIC_DIR = path.join(__dirname, 'public');

// Texture path: prefer self-hosted, fall back to redirect-to-CDN if missing.
app.get('/textures/:file', (req, res) => {
  const safe = req.params.file.replace(/[^a-zA-Z0-9._-]/g, '');
  const local = path.join(STATIC_DIR, 'textures', safe);
  if (fs.existsSync(local)) {
    res.set('Cache-Control', 'public, max-age=2592000, immutable');
    return res.sendFile(local);
  }
  return res.redirect(302, `https://unpkg.com/three-globe@2.31.0/example/img/${safe}`);
});

app.use(express.static(STATIC_DIR, {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  index: 'index.html',
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// --- Boot + graceful shutdown ------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`[terrapulse] listening on :${PORT} mode=${APP_MODE} env=${process.env.NODE_ENV || 'development'}`);
  if (!auth.isAuthEnabled()) console.warn('[terrapulse] auth disabled (set GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET)');
  if (!billing.isEnabled()) console.warn('[terrapulse] billing disabled (set STRIPE_SECRET_KEY + STRIPE_PRICE_VERIFIED)');
  if (!process.env.RESEND_API_KEY) console.warn('[terrapulse] email disabled (set RESEND_API_KEY)');
});

function shutdown(signal) {
  console.log(`[terrapulse] ${signal} received, draining...`);
  server.close(async () => {
    await db.shutdown();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
