#!/usr/bin/env node
// Daily AI-launch digest cron.
// 1. Fetch new AI repos from last 24h.
// 2. Geocode them.
// 3. For each subscriber to the 'ai_launch' alert, build a personalised digest
//    (filtered by minStars / language if set) and email via Resend.
// 4. Mark repos as seen so we don't repeat them tomorrow.

require('dotenv').config();
const db = require('../db');
const { fetchRecentAIRepos } = require('../lib/ai_launches');
const { locateRepos } = require('../lib/geocode');
const { sendEmail } = require('../lib/email');

function escape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderDigest(repos, publicUrl) {
  const items = repos.map((r) => `
    <li style="margin-bottom:14px;padding:10px;border:1px solid #e5e7eb;border-radius:8px">
      <div style="font-weight:600">
        <a href="${escape(r.url)}" style="color:#0ea5e9;text-decoration:none">${escape(r.name)}</a>
        &middot; <span style="color:#64748b">⭐ ${r.stars}</span>
        ${r.language ? `&middot; <span style="color:#64748b">${escape(r.language)}</span>` : ''}
      </div>
      <div style="color:#334155;font-size:14px;margin-top:4px">${escape(r.description || '')}</div>
      ${r.ownerLocation ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px">📍 ${escape(r.ownerLocation)}</div>` : ''}
    </li>`).join('');

  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 4px;font-size:20px">TerraPulse · AI Launches</h1>
      <p style="color:#64748b;margin:0 0 16px;font-size:13px">${repos.length} new AI/ML repos crossed your threshold in the last 24h.</p>
      <ul style="list-style:none;padding:0;margin:0">${items}</ul>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px">Sent by TerraPulse. <a href="${publicUrl}/account" style="color:#94a3b8">Manage alerts</a>.</p>
    </div>
  </body></html>`;
}

function renderText(repos) {
  return repos.map((r) =>
    `${r.name} (⭐ ${r.stars}${r.language ? ', ' + r.language : ''})\n  ${r.description || ''}\n  ${r.url}`
  ).join('\n\n');
}

async function main() {
  const publicUrl = process.env.PUBLIC_URL || 'https://terrapulse.example';

  console.log('[digest] fetching AI launches...');
  let repos;
  try {
    repos = await fetchRecentAIRepos({ daysBack: 1, minStars: 20, perPage: 50 });
  } catch (err) {
    console.error('[digest] github fetch failed:', err.message);
    process.exit(0);
  }
  console.log(`[digest] ${repos.length} candidate repos`);

  const fresh = await db.getUnseenAILaunches(repos);
  console.log(`[digest] ${fresh.length} unseen`);
  if (!fresh.length) {
    console.log('[digest] nothing to send.');
    await db.shutdown();
    process.exit(0);
  }

  const located = await locateRepos(fresh);
  console.log(`[digest] ${located.length} located`);

  const subs = await db.getAlertsByKind('ai_launch');
  console.log(`[digest] ${subs.length} subscribers`);

  let sent = 0;
  for (const sub of subs) {
    const cfg = sub.config || {};
    const minStars = Number(cfg.minStars) || 20;
    const language = cfg.language ? String(cfg.language).toLowerCase() : null;
    const filtered = fresh.filter((r) => {
      if (r.stars < minStars) return false;
      if (language && (r.language || '').toLowerCase() !== language) return false;
      return true;
    });
    if (!filtered.length) continue;

    try {
      await sendEmail({
        to: sub.email,
        subject: `${filtered.length} new AI launches today`,
        html: renderDigest(filtered, publicUrl),
        text: renderText(filtered),
      });
      await db.markAlertSent(sub.id);
      sent++;
    } catch (err) {
      console.warn(`[digest] failed for ${sub.email}: ${err.message}`);
    }
  }

  await db.markAILaunchesSeen(fresh);
  console.log(`[digest] sent ${sent} emails.`);
  await db.shutdown();
}

main().catch((err) => {
  console.error('[digest] fatal:', err.message);
  process.exit(0);
});
