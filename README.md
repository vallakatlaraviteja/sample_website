# TerraPulse

A 3D real-time Earth dashboard fusing live world and tech signals into a single, interactive globe.

- **Live earthquakes** (USGS, refreshed every minute)
- **Live ISS position** (open-notify, refreshed every 5 seconds)
- **Trending tech repos** (GitHub search API, refreshed every 10 minutes)
- **User pulses** — geo-tagged events you submit, persisted in Postgres

Built as a single Node/Express service that serves a Three.js / globe.gl frontend and a JSON API, backed by PostgreSQL. One-click deploy to Render via `render.yaml`.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, Three.js, globe.gl (CDN), no build step |
| Backend | Node 20+, Express, Helmet, compression, rate-limit |
| Database | PostgreSQL (graceful in-memory fallback if unavailable) |
| Deploy | Render (Web Service + managed Postgres) |

No build pipeline. No framework. Loads in one round trip.

---

## Local development

```bash
npm install
cp .env.example .env
# edit .env with your DATABASE_URL (or set DISABLE_DB=true)
npm run migrate
npm start
```

Open http://localhost:3000.

To run without a database (in-memory pulses, lost on restart):

```bash
DISABLE_DB=true npm start
```

---

## Deploy to Render

1. Push this repo to GitHub.
2. In Render, click **New +** → **Blueprint** → select this repo.
3. Render reads `render.yaml`, creates the web service and Postgres database, wires `DATABASE_URL` automatically.
4. Build runs `npm install && npm run migrate`. App starts on `npm start`.

The blueprint uses Render's free plans for both the web service and the database. The web service spins down after 15 minutes of inactivity on free plan; first request after spin-down is slow (~30-50s).

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + db status |
| GET | `/api/signals/iss` | current ISS lat/lng |
| GET | `/api/signals/quakes` | last 24h earthquakes (USGS) |
| GET | `/api/signals/tech` | trending GitHub repos this week |
| GET | `/api/pulses?limit=200` | user-submitted pulses |
| POST | `/api/pulses` | create a pulse (rate-limited 10/min/IP) |

Pulse body:

```json
{
  "title": "Open-source AI summit",
  "category": "tech",
  "description": "optional",
  "url": "https://...",
  "lat": 37.77,
  "lng": -122.42
}
```

Categories: `tech`, `science`, `climate`, `space`, `health`, `culture`, `other`.

---

## Critical Combat Mode — verdict on this build

**ASSUMPTIONS attacked**
- "Best ever existed" is marketing, not a spec. I built something concretely deployable instead of chasing a slogan.
- Free Render tier was assumed acceptable. If you need always-on, this build does not meet that.
- Vanilla JS over React/Vue was assumed. Rationale: zero build step, fastest first paint, smallest LOC for the same UX. If you plan to grow the UI past a few panels, this will not scale and you will regret it around month two.

**ATTACK angles**
- *Investor:* "Is there a moat?" No. The data is public. Any team can reproduce this in a weekend. Moat would need proprietary data, network effect from pulses, or paid alerts.
- *Customer:* "Why would I come back?" There is no notification, no follow, no account. Currently a one-shot demo. Retention loop is not built.
- *Architect:* Single Node process serves static + API + caches. Fine at 100 req/s, dies at 5k. No queue, no worker, no CDN for the globe textures (loaded from unpkg — third-party SPOF).
- *Compliance:* Zero PII collected, but free-text pulse fields are an obvious abuse vector. There is no moderation, profanity filter, or auth. Public submission with rate-limit only.
- *Malicious user:* Can spam 10 pulses/min/IP. Can rotate IPs. Can post offensive titles. Mitigation needed before any public launch: auth + manual moderation queue + content classifier.
- *Competitor:* zoom.earth, ventusky, Cesium ion, Kepler.gl already exist. None are positioned as "world+tech feed". That niche is real but thin.

**EDGE CASES handled**
- DB down → app stays alive in memory-fallback mode.
- Third-party API timeouts → cached values served stale, no user-facing error.
- Rate-limited writes (10/min/IP).
- Lat/lng + category + length validation server-side.
- HTML escaping on all user/third-party text.

**EDGE CASES NOT handled**
- No auth → spam vector.
- No moderation → offensive content vector.
- No WebGL fallback → user with no GPU sees a blank screen.
- Texture assets loaded from `unpkg` — if unpkg is down, the globe is unstyled.
- Render free-tier cold start: first user every 15 minutes waits 30-50 seconds.
- IPv6, screen-reader, and reduced-motion experiences are minimal.

**ALTERNATIVES considered & rejected**
- Cesium ion — heavier, requires API key, overkill for this scope.
- React + Vite — added 200kb JS and a build step for zero UX gain at this size.
- SQLite on Render disk — Render free tier has ephemeral disk, would lose data on every deploy. Postgres is the right call.
- Server-side rendering — pointless for an interactive 3D canvas.

**VERDICT: PIVOT**
Not "the best website ever." That is not a deliverable. What this *is*: a real, deployable, full-stack 3D dashboard with live data and a clear extension surface. Ship it as a portfolio piece or a v0 of a real product. Do **not** ship publicly without adding auth, moderation, and a CDN for textures.

If the goal is a product: the next three moves are (1) auth + email follow on pulse categories, (2) move textures to your own CDN, (3) add a moderation queue and a single paid tier for "verified pulse" badges. Until those exist, this is a tech demo, not a business.
