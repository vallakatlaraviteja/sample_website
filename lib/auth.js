// GitHub OAuth + cookie sessions. No third-party auth lib - just fetch + crypto.

const crypto = require('crypto');
const cookie = require('cookie');
const db = require('../db');

const SESSION_COOKIE = 'tp_sess';
const SESSION_DAYS = 30;

function isAuthEnabled() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function adminLogins() {
  return new Set(
    (process.env.ADMIN_LOGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function startUrl(state) {
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  u.searchParams.set('scope', 'read:user user:email');
  u.searchParams.set('state', state);
  u.searchParams.set('redirect_uri', `${process.env.PUBLIC_URL}/api/auth/github/callback`);
  return u.toString();
}

async function exchangeCode(code) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.PUBLIC_URL}/api/auth/github/callback`,
    }),
  });
  if (!res.ok) throw new Error(`oauth exchange ${res.status}`);
  const j = await res.json();
  if (!j.access_token) throw new Error('no access_token');
  return j.access_token;
}

async function fetchGithubUser(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'TerraPulse/2.0',
  };
  const [u, emails] = await Promise.all([
    fetch('https://api.github.com/user', { headers }).then((r) => r.json()),
    fetch('https://api.github.com/user/emails', { headers }).then((r) => (r.ok ? r.json() : [])),
  ]);
  let primary = null;
  if (Array.isArray(emails)) {
    primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
  }
  return {
    github_id: u.id,
    login: u.login,
    email: primary?.email || u.email || null,
    avatar_url: u.avatar_url,
    location: u.location || null,
  };
}

async function upsertUser(profile) {
  const admins = adminLogins();
  const isAdmin = admins.has(String(profile.login).toLowerCase());
  if (!db.pool) {
    // memory-only bootstrap user (dev with DISABLE_DB)
    return { id: profile.github_id, ...profile, is_admin: isAdmin, is_verified: false };
  }
  const { rows } = await db.pool.query(
    `INSERT INTO users (github_id, login, email, avatar_url, location, is_admin)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (github_id) DO UPDATE SET
       login = EXCLUDED.login,
       email = COALESCE(EXCLUDED.email, users.email),
       avatar_url = EXCLUDED.avatar_url,
       location = EXCLUDED.location,
       is_admin = users.is_admin OR EXCLUDED.is_admin
     RETURNING *`,
    [profile.github_id, profile.login, profile.email, profile.avatar_url, profile.location, isAdmin]
  );
  return rows[0];
}

async function createSession(userId) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  if (db.pool) {
    await db.pool.query(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)`,
      [token, userId, expires]
    );
  }
  return { token, expires };
}

async function destroySession(token) {
  if (db.pool && token) {
    await db.pool.query(`DELETE FROM sessions WHERE token = $1`, [token]).catch(() => {});
  }
}

async function loadSession(token) {
  if (!token || !db.pool) return null;
  try {
    const { rows } = await db.pool.query(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    return rows[0] || null;
  } catch (err) {
    console.warn('[auth] loadSession failed:', err.message);
    return null;
  }
}

function cookieOpts(maxAgeSec) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec,
  };
}

function setSessionCookie(res, token, expires) {
  const maxAge = Math.floor((expires.getTime() - Date.now()) / 1000);
  res.setHeader('Set-Cookie', cookie.serialize(SESSION_COOKIE, token, cookieOpts(maxAge)));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookie.serialize(SESSION_COOKIE, '', cookieOpts(0)));
}

function readSessionCookie(req) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parsed = cookie.parse(raw);
  return parsed[SESSION_COOKIE] || null;
}

// Express middleware: attach req.user if logged in. Never throws.
async function attachUser(req, res, next) {
  req.user = null;
  try {
    const token = readSessionCookie(req);
    if (token) {
      const u = await loadSession(token);
      if (u) {
        req.user = u;
        req.sessionToken = token;
      }
    }
  } catch (err) { /* ignore */ }
  next();
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth_required' });
  if (!req.user.is_admin) return res.status(403).json({ error: 'admin_required' });
  next();
}

module.exports = {
  isAuthEnabled,
  startUrl,
  exchangeCode,
  fetchGithubUser,
  upsertUser,
  createSession,
  destroySession,
  loadSession,
  setSessionCookie,
  clearSessionCookie,
  attachUser,
  requireUser,
  requireAdmin,
};
