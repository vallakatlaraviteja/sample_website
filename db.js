// db.js - Postgres pool with graceful in-memory fallback.

const { Pool } = require('pg');

const DISABLE_DB = process.env.DISABLE_DB === 'true' || !process.env.DATABASE_URL;

let pool = null;
const memoryStore = []; // fallback in-memory pulses (no auth/moderation)

if (!DISABLE_DB) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => console.error('[db] pool error:', err.message));
}

function rowToPulse(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    lat: Number(r.lat),
    lng: Number(r.lng),
    url: r.url,
    status: r.status,
    verified: r.verified,
    user: r.user_login ? { login: r.user_login, avatar: r.user_avatar } : null,
    createdAt: Number(r.created_at_ms),
  };
}

const PULSE_SELECT = `
  SELECT p.id, p.title, p.description, p.category, p.lat, p.lng, p.url,
         p.status, p.verified,
         u.login AS user_login, u.avatar_url AS user_avatar,
         extract(epoch from p.created_at) * 1000 AS created_at_ms
  FROM pulses p
  LEFT JOIN users u ON u.id = p.user_id
`;

async function getPulses({ limit = 200, status = 'approved', includePending = false } = {}) {
  if (!pool) {
    return memoryStore.slice(-limit).reverse();
  }
  try {
    const cond = includePending ? `WHERE p.status IN ('approved','pending')` : `WHERE p.status = $2`;
    const params = includePending ? [limit] : [limit, status];
    const { rows } = await pool.query(
      `${PULSE_SELECT} ${cond} ORDER BY p.created_at DESC LIMIT $1`,
      params
    );
    return rows.map(rowToPulse);
  } catch (err) {
    console.error('[db] getPulses fallback:', err.message);
    return memoryStore.slice(-limit).reverse();
  }
}

async function getPendingPulses({ limit = 100 } = {}) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `${PULSE_SELECT} WHERE p.status = 'pending' ORDER BY p.created_at ASC LIMIT $1`,
    [limit]
  );
  return rows.map(rowToPulse);
}

async function createPulse({ title, description, category, lat, lng, url, userId, status, verified }) {
  const record = {
    title: String(title).slice(0, 140),
    description: description ? String(description).slice(0, 1000) : null,
    category: String(category).slice(0, 32),
    lat: Number(lat),
    lng: Number(lng),
    url: url ? String(url).slice(0, 500) : null,
    userId: userId || null,
    status: status || 'pending',
    verified: Boolean(verified),
  };

  if (!pool) {
    const item = { id: memoryStore.length + 1, ...record, createdAt: Date.now() };
    memoryStore.push(item);
    return item;
  }

  const { rows } = await pool.query(
    `INSERT INTO pulses (title, description, category, lat, lng, url, user_id, status, verified)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [record.title, record.description, record.category, record.lat, record.lng,
     record.url, record.userId, record.status, record.verified]
  );
  const id = rows[0].id;
  const { rows: full } = await pool.query(`${PULSE_SELECT} WHERE p.id = $1`, [id]);
  return rowToPulse(full[0]);
}

async function moderatePulse({ pulseId, action, moderatorId, reason }) {
  if (!pool) throw new Error('db_disabled');
  const status = action === 'approve' ? 'approved' : 'rejected';
  await pool.query(
    `UPDATE pulses SET status = $2, reviewer_id = $3, reviewed_at = NOW(), reject_reason = $4 WHERE id = $1`,
    [pulseId, status, moderatorId, reason || null]
  );
  await pool.query(
    `INSERT INTO mod_log (pulse_id, moderator_id, action, reason) VALUES ($1,$2,$3,$4)`,
    [pulseId, moderatorId, action, reason || null]
  );
}

// --- Alerts -----------------------------------------------------------------
async function createAlert({ userId, kind, config, email }) {
  if (!pool) throw new Error('db_disabled');
  const { rows } = await pool.query(
    `INSERT INTO alerts (user_id, kind, config, email) VALUES ($1,$2,$3::jsonb,$4) RETURNING *`,
    [userId, kind, JSON.stringify(config || {}), email]
  );
  return rows[0];
}

async function getUserAlerts(userId) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function deleteAlert(userId, alertId) {
  if (!pool) return;
  await pool.query(`DELETE FROM alerts WHERE id = $1 AND user_id = $2`, [alertId, userId]);
}

async function getAlertsByKind(kind) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT * FROM alerts WHERE kind = $1 AND enabled = TRUE`,
    [kind]
  );
  return rows;
}

async function markAlertSent(alertId) {
  if (!pool) return;
  await pool.query(`UPDATE alerts SET last_sent_at = NOW() WHERE id = $1`, [alertId]);
}

// --- AI launch dedup --------------------------------------------------------
async function getUnseenAILaunches(repos) {
  if (!pool || !repos.length) return repos;
  const ids = repos.map((r) => r.id);
  const { rows } = await pool.query(
    `SELECT repo_id FROM ai_launch_seen WHERE repo_id = ANY($1::bigint[])`,
    [ids]
  );
  const seen = new Set(rows.map((r) => Number(r.repo_id)));
  return repos.filter((r) => !seen.has(r.id));
}

async function markAILaunchesSeen(repos) {
  if (!pool || !repos.length) return;
  const values = repos.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',');
  const params = repos.flatMap((r) => [r.id, r.name]);
  await pool.query(
    `INSERT INTO ai_launch_seen (repo_id, full_name) VALUES ${values}
     ON CONFLICT (repo_id) DO NOTHING`,
    params
  );
}

async function healthcheck() {
  if (!pool) return { db: 'disabled', memoryStoreSize: memoryStore.length };
  try {
    await pool.query('SELECT 1');
    return { db: 'ok' };
  } catch (err) {
    return { db: 'error', error: err.message };
  }
}

async function shutdown() {
  if (pool) await pool.end().catch(() => {});
}

module.exports = {
  pool,
  memoryStore,
  getPulses,
  getPendingPulses,
  createPulse,
  moderatePulse,
  createAlert,
  getUserAlerts,
  deleteAlert,
  getAlertsByKind,
  markAlertSent,
  getUnseenAILaunches,
  markAILaunchesSeen,
  healthcheck,
  shutdown,
};
