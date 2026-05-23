// db.js - Postgres pool with graceful fallback to in-memory store.
// Critical Combat note: if DB is down, app keeps running read-only with mem store.
// That is a deliberate degradation, not "production safe". For a real product
// you'd queue writes or fail loud. For a demo, staying alive matters more.

const { Pool } = require('pg');

const DISABLE_DB = process.env.DISABLE_DB === 'true' || !process.env.DATABASE_URL;

let pool = null;
const memoryStore = []; // fallback in-memory pulses

if (!DISABLE_DB) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[db] unexpected pg pool error:', err.message);
  });
}

async function query(text, params) {
  if (!pool) throw new Error('DB disabled');
  return pool.query(text, params);
}

async function getPulses({ limit = 200 } = {}) {
  if (!pool) {
    return memoryStore.slice(-limit).reverse();
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, category, lat, lng, url,
              extract(epoch from created_at) * 1000 AS created_at_ms
       FROM pulses
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      lat: Number(r.lat),
      lng: Number(r.lng),
      url: r.url,
      createdAt: Number(r.created_at_ms),
    }));
  } catch (err) {
    console.error('[db] getPulses failed, falling back to memory:', err.message);
    return memoryStore.slice(-limit).reverse();
  }
}

async function createPulse({ title, description, category, lat, lng, url }) {
  const record = {
    title: String(title).slice(0, 140),
    description: description ? String(description).slice(0, 1000) : null,
    category: String(category).slice(0, 32),
    lat: Number(lat),
    lng: Number(lng),
    url: url ? String(url).slice(0, 500) : null,
  };

  if (!pool) {
    const item = {
      id: memoryStore.length + 1,
      ...record,
      createdAt: Date.now(),
    };
    memoryStore.push(item);
    return item;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO pulses (title, description, category, lat, lng, url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, category, lat, lng, url,
                 extract(epoch from created_at) * 1000 AS created_at_ms`,
      [record.title, record.description, record.category, record.lat, record.lng, record.url]
    );
    const r = rows[0];
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      lat: Number(r.lat),
      lng: Number(r.lng),
      url: r.url,
      createdAt: Number(r.created_at_ms),
    };
  } catch (err) {
    console.error('[db] createPulse failed:', err.message);
    throw err;
  }
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

module.exports = { query, getPulses, createPulse, healthcheck, pool };
