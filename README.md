# TerraPulse

A live 3D map of new AI/ML launches on Earth — with email alerts, moderated community pulses, and a verified paid tier.

Built as a single deployable Node service: 3D globe frontend (Three.js / globe.gl), JSON API, PostgreSQL, GitHub OAuth, Stripe billing, and a daily digest cron — all driven from one `render.yaml` blueprint.

> v2 — pivoted from "world+tech demo" to a single niche (**AI launches**) with a real product loop: real geocoded coordinates, sign-in, moderation, paid alerts.

---

## What v2 fixes (vs v1)

| v1 problem | v2 fix |
|---|---|
| Repos placed at hash-derived **fake coordinates** | Real `users/{login}.location` lookup → Nominatim geocode → cached in `gh_user_locations`. Repos with no resolvable location are **omitted**, not fabricated. |
| Anonymous public submissions, zero moderation | GitHub OAuth required to submit. Profanity + URL-shortener filter. Unverified pulses go to **admin review queue**. |
| Globe textures hot-linked from `unpkg` (SPOF) | Textures vendored to `public/textures/` at install time. `/textures/:file` falls back to CDN if the local file is missing. |
| Vague "v0 of paid product" | Concrete: **$5/mo Verified tier** via Stripe Checkout. Verified users skip moderation, get a badge, and can register up to 25 email alerts (free tier: 3). |
| ISS→tech arcs that meant nothing | Removed. Visual noise, not signal. |
| No incentive to submit pulses | Verified badge on the globe + side panel. Email alerts as the persistent reason to come back. |
| Auto-rotation ignored `prefers-reduced-motion` | Respected. Spinner / pulsing dot also disabled in reduced-motion. |
| No graceful shutdown / OG tags / cron / health check | All present. |

---

## Architecture

```
[ Browser ]  --HTML/JS-->  [ Node + Express ]  --SQL-->  [ Postgres ]
                                  |
                                  +--> GitHub OAuth (sign-in)
                                  +--> GitHub Search API (AI repos)
                                  +--> Nominatim / OSM (geocode owners)
                                  +--> USGS (earthquakes)
                                  +--> wheretheiss.at (ISS)
                                  +--> Stripe (Verified tier)
                                  +--> Resend (email alerts)

[ Render Cron ] --daily--> [ send-digests.js ] -> Resend -> subscribers
```

One web service. One DB. One cron. All defined in `render.yaml`.

## Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | Vanilla JS + Three.js + globe.gl (CDN) | No build step, fastest first paint |
| Backend | Node 20 + Express, helmet, compression, rate-limit, CSP | Single process, full stack |
| Auth | GitHub OAuth + cookie sessions in Postgres | No third-party auth lib |
| DB | PostgreSQL with in-memory fallback | Survives DB-down |
| Billing | Stripe Checkout + webhook | $5/mo subscription only — minimal surface |
| Email | Resend (3k/mo free) | Console-logs in dev when key absent |
| Cron | Render cron, runs daily at 13:00 UTC | Built-in to Render free plan |

---

## Local setup

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL at minimum (others optional - see below)
npm run migrate
npm start
```

Open http://localhost:3000.

### What works without each optional env

| Missing | Effect |
|---|---|
| `DATABASE_URL` (or `DISABLE_DB=true`) | App still runs. Pulses live in memory, lost on restart. No auth/alerts. |
| `GITHUB_CLIENT_ID/SECRET` | Sign-in disabled. Pulse submission falls back to anonymous-pending in dev. |
| `RESEND_API_KEY` | Digest emails print to server logs instead of sending. |
| `STRIPE_*` | Verified tier disabled. App still serves free tier. |

---

## Deploy to Render

1. Push to GitHub.
2. Render → **New +** → **Blueprint** → pick this repo. Render reads `render.yaml`, provisions:
   - `terrapulse` (web service, free)
   - `terrapulse-digests` (cron, daily 13:00 UTC, free)
   - `terrapulse-db` (Postgres, free)
3. After first deploy, set the secret env vars on the service (Render won't sync them via blueprint):
   - `PUBLIC_URL` = your Render URL (e.g. `https://terrapulse.onrender.com`)
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (create at https://github.com/settings/developers; callback `${PUBLIC_URL}/api/auth/github/callback`)
   - `ADMIN_LOGINS` = comma-separated GitHub logins that should see the moderation queue
   - `RESEND_API_KEY`, `EMAIL_FROM` (create domain on resend.com — it will work with their default sandbox sender too)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_VERIFIED`
     - Webhook endpoint: `${PUBLIC_URL}/api/billing/webhook`
4. Trigger a re-deploy. Cron runs on its own schedule.

---

## API

### Read
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness + db status |
| GET | `/api/config` | feature flags + current user |
| GET | `/api/signals/iss` | { lat, lng, timestamp } |
| GET | `/api/signals/quakes` | last-24h USGS feed |
| GET | `/api/signals/ai_launches` | `{ located, pending, total }` — only located repos have coords |
| GET | `/api/pulses?limit=200` | approved community pulses |

### Auth
| Method | Path |
|---|---|
| GET | `/api/auth/github/start` (redirects to GitHub) |
| GET | `/api/auth/github/callback` |
| POST | `/api/auth/logout` |

### Pulses (auth required when auth is enabled)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/pulses` | rate limit 8/min/IP. Verified users auto-publish; others queue for moderation. |

### Alerts (auth required)
| Method | Path |
|---|---|
| GET | `/api/alerts` |
| POST | `/api/alerts` (`kind`: `ai_launch` or `quake`) |
| DELETE | `/api/alerts/:id` |

Free tier max 3 alerts. Verified tier max 25.

### Admin (admin required)
| Method | Path |
|---|---|
| GET | `/api/admin/pending` |
| POST | `/api/admin/pulses/:id/decision` (`{ action: "approve" \| "reject", reason? }`) |

### Billing
| Method | Path |
|---|---|
| POST | `/api/billing/checkout` (returns Stripe URL) |
| POST | `/api/billing/webhook` (Stripe → us, raw body) |

---

## Critical Combat Mode — v2 verdict

The four pivots requested are **shipped**:

1. **Real coordinates ✓** — `lib/geocode.js` + `gh_user_locations` cache. No fake data.
2. **Auth + moderation + abuse controls ✓** — GitHub OAuth, sessions, profanity filter, URL-shortener block, mod queue, audit log, admin-only endpoints, rate limit.
3. **Self-hosted textures ✓** — `scripts/vendor-textures.js` runs at `postinstall`. `/textures/:file` falls back to CDN if local file is missing. CSP allows both.
4. **One niche with willingness-to-pay test ✓** — "AI launches" wedge + Stripe-backed Verified tier ($5/mo) with concrete value: skip moderation, 25 alerts vs 3, badge.

### What's still honest about this build

- **Stripe paid tier is not validated.** I built the *infrastructure* for $5/mo. Whether anyone *pays* requires you to actually run it past 50–100 AI builders and measure conversion. The infrastructure is necessary but not sufficient.
- **Nominatim is rate-limited at 1 req/s** and is OSM hobby infrastructure. Heavy traffic should switch to a paid geocoder or self-host Nominatim. For TerraPulse's expected scale (≤100 unique repo owners/day), this is fine.
- **Render free Postgres expires after 90 days.** Document migrations to Neon/Supabase if you keep this around.
- **Free Render web tier still cold-starts in 30–50s.** The fix is paying $7/mo for always-on, or moving the static frontend to Cloudflare Pages and only the API to Render. Easy migration — your `public/` directory is fully static.
- **No tests, no CI, no observability** beyond `/api/health`. Add Sentry/PostHog and a smoke test before treating this as production.
- **No incident plan** if a moderator approves illegal/defamatory content. You need a takedown process and DMCA agent on record before any traction.

### Verdict

**v1 was a tech demo. v2 is a deployable product chassis** with one validated wedge audience (AI builders), real geo data, real auth, real billing, real email. It is the smallest defensible thing that could become a $X00/mo side product if (and only if) the conversion test passes.

Ship it to 100 users from r/MachineLearning or Hacker News. Measure: signup rate → alert-creation rate → free-to-verified conversion. If conversion < 1%, kill the paid tier and pivot the wedge. If > 3%, consider second-tier features (team accounts, API access, embedding the globe).
