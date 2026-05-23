// Lightweight content moderation for user-submitted pulses.
// - Profanity word-list filter (kept short and conservative).
// - URL host blocklist + scheme whitelist.
// - Returns { allow, autoApprove, reasons }.
// Verified (paid) users: autoApprove=true if it passes the basic filter.
// Unverified users: autoApprove=false -> queued for admin review.

const PROFANITY = new Set([
  // Intentionally short. Real product needs a vetted list + ML classifier.
  'cunt', 'nigger', 'faggot', 'kike', 'retard', 'tranny',
]);

const URL_BLOCK_HOSTS = new Set([
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'is.gd', 'ow.ly',
  'rebrand.ly', 'cutt.ly', 'shorte.st',
]);

function tokens(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9']+/).filter(Boolean);
}

function checkText(s) {
  for (const t of tokens(s)) {
    if (PROFANITY.has(t)) return { ok: false, reason: 'profanity' };
  }
  return { ok: true };
}

function checkUrl(u) {
  if (!u) return { ok: true };
  let url;
  try {
    url = new URL(u);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (!/^https?:$/.test(url.protocol)) return { ok: false, reason: 'bad_scheme' };
  const host = url.hostname.toLowerCase();
  if (URL_BLOCK_HOSTS.has(host)) return { ok: false, reason: 'shortener_blocked' };
  return { ok: true };
}

// Heuristic: short repeated/all-caps spam.
function looksSpammy(title, description) {
  const t = String(title || '');
  if (t.length < 3) return true;
  const upper = (t.match(/[A-Z]/g) || []).length;
  if (t.length > 8 && upper / t.length > 0.7) return true;
  if (/(.)\1{6,}/.test(t)) return true;
  return false;
}

function evaluate({ title, description, url, isVerified }) {
  const reasons = [];
  for (const [field, val] of [['title', title], ['description', description]]) {
    const r = checkText(val);
    if (!r.ok) reasons.push(`${field}_${r.reason}`);
  }
  const u = checkUrl(url);
  if (!u.ok) reasons.push(`url_${u.reason}`);
  if (looksSpammy(title, description)) reasons.push('looks_spammy');

  if (reasons.length) return { allow: false, autoApprove: false, reasons };
  return {
    allow: true,
    autoApprove: Boolean(isVerified),
    reasons: [],
  };
}

module.exports = { evaluate };
