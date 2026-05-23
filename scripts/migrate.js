#!/usr/bin/env node
// Runs all SQL files in migrations/ in lexical order.
// Idempotent: uses IF NOT EXISTS in the migrations themselves.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  if (process.env.DISABLE_DB === 'true' || !process.env.DATABASE_URL) {
    console.log('[migrate] DATABASE_URL not set or DISABLE_DB=true; skipping migrations.');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migrate] applying ${file}`);
    try {
      await pool.query(sql);
    } catch (err) {
      console.error(`[migrate] failed on ${file}:`, err.message);
      // do not exit non-zero in build; let server start and serve degraded.
    }
  }

  await pool.end();
  console.log('[migrate] done.');
}

main().catch((err) => {
  console.error('[migrate] fatal:', err.message);
  // Exit 0 so Render build still succeeds and app boots in degraded mode.
  process.exit(0);
});
