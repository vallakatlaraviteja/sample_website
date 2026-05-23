// TerraPulse v2 frontend.
// New: auth state, alerts manager, admin queue, real AI launches feed,
// reduced-motion respect, self-hosted textures with CDN fallback.

// --- WebGL pre-flight -------------------------------------------------------
// Detect WebGL support BEFORE we touch globe.gl. globe.gl will silently
// produce a black canvas on failure; users on no-GPU / headless / locked-down
// browsers should get a usable text dashboard instead.
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Some browsers expose a context but lose it immediately.
    const lose = gl.getExtension && gl.getExtension('WEBGL_lose_context');
    if (lose && typeof lose.loseContext === 'function') {
      // probe only; do not actually call loseContext on the live ctx.
    }
    return true;
  } catch (_e) {
    return false;
  }
}

if (!window.Globe || !hasWebGL()) {
  bootFallback(!window.Globe ? 'globe.gl failed to load' : 'WebGL unavailable');
} else {
  bootGlobe();
}

// --- Fallback boot (no globe) ----------------------------------------------
async function bootFallback(reason) {
  console.warn('[terrapulse] running in fallback mode:', reason);
  document.body.classList.add('no-webgl');
  const fb = document.getElementById('webgl-fallback');
  if (fb) fb.hidden = false;
  const loading = document.getElementById('loading');
  if (loading) loading.remove();

  const fmt = (s) => (s == null ? '' : String(s));
  const esc = (s) => fmt(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function refresh() {
    const [quakes, tech, iss, pulses] = await Promise.allSettled([
      getJson('/api/signals/quakes'),
      getJson('/api/signals/tech'),
      getJson('/api/signals/iss'),
      getJson('/api/pulses?limit=20'),
    ]);

    const ulQ = document.getElementById('fb-quakes');
    if (ulQ && quakes.status === 'fulfilled') {
      const top = quakes.value.slice().sort((a, b) => (b.mag || 0) - (a.mag || 0)).slice(0, 10);
      ulQ.innerHTML = top.length
        ? top.map((q) => `<li><strong>M ${q.mag?.toFixed?.(1) ?? '?'}</strong> · ${esc(q.place)}</li>`).join('')
        : '<li class="fb-empty">no recent quakes</li>';
    }

    const ulT = document.getElementById('fb-tech');
    if (ulT && tech.status === 'fulfilled') {
      const top = tech.value.slice(0, 10);
      ulT.innerHTML = top.length
        ? top.map((t) => `<li><strong>${esc(t.name)}</strong> · ⭐ ${t.stars}</li>`).join('')
        : '<li class="fb-empty">no data</li>';
    }

    const issEl = document.getElementById('fb-iss');
    if (issEl && iss.status === 'fulfilled') {
      const v = iss.value;
      issEl.textContent = `lat ${v.lat.toFixed(2)}, lng ${v.lng.toFixed(2)}` +
        (v.altitudeKm ? ` · alt ${v.altitudeKm.toFixed(0)}km` : '');
    } else if (issEl) {
      issEl.textContent = 'unavailable';
    }

    const ulP = document.getElementById('fb-pulses');
    if (ulP && pulses.status === 'fulfilled') {
      ulP.innerHTML = pulses.value.length
        ? pulses.value.map((p) => `<li><strong>${esc(p.title)}</strong> · ${esc(p.category)}</li>`).join('')
        : '<li class="fb-empty">no pulses yet</li>';
    }
  }

  refresh();
  setInterval(refresh, 60_000);
}

// --- Globe boot -------------------------------------------------------------
function bootGlobe() {
const Globe = window.Globe;

const state = {
  config: null,
  layers: { ai: true, quakes: true, iss: true, pulses: true },
  signals: { ai: [], aiPending: 0, quakes: [], iss: null, pulses: [] },
  panelTab: 'ai',
  panelCollapsed: false,
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- DOM refs ---------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const $globe = $('globe-container');
const $loading = $('loading');
const $panel = $('side-panel');
const $panelBody = $('panel-body');
const $panelToggle = $('panel-toggle');
const $status = $('status-text');
const $modal = $('pulse-modal');
const $form = $('pulse-form');
const $hint = $('pulse-hint');
const $reviewNote = $('review-note');
const $alertsModal = $('alerts-modal');
const $alertForm = $('alert-form');
const $alertsList = $('alerts-list');
const $upgradeCard = $('upgrade-card');
const $adminModal = $('admin-modal');
const $adminList = $('admin-list');

// --- Globe setup ------------------------------------------------------------
const TEX_LOCAL = '/textures';
const TEX_CDN = 'https://unpkg.com/three-globe@2.31.0/example/img';

function tex(name) {
  // Server redirects local 404 -> CDN, so we can always point at /textures/.
  return `${TEX_LOCAL}/${name}`;
}

const globe = Globe()
  .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-night.jpg')
  .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-topology.png')
  .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/night-sky.png')
  .globeImageUrl(tex('earth-night.jpg'))
  .bumpImageUrl(tex('earth-topology.png'))
  .backgroundImageUrl(tex('night-sky.png'))
  .atmosphereColor('#22d3ee')
  .atmosphereAltitude(0.22)
  .showGraticules(false)
  ($globe);

const controls = globe.controls();
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 0.35;
controls.enableDamping = true;
controls.dampingFactor = 0.08;

controls.addEventListener('start', () => { controls.autoRotate = false; });

function resize() { globe.width($globe.clientWidth); globe.height($globe.clientHeight); }
window.addEventListener('resize', resize); resize();
globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);

// --- Layers -----------------------------------------------------------------
function renderLayers() {
  const points = [];

  if (state.layers.ai) {
    for (const t of state.signals.ai) {
      points.push({
        kind: 'ai', lat: t.lat, lng: t.lng,
        size: 0.35 + Math.min(1.2, Math.log10((t.stars || 1) + 1) * 0.45),
        color: '#22d3ee', data: t,
      });
    }
  }
  if (state.layers.quakes) {
    for (const q of state.signals.quakes) {
      points.push({
        kind: 'quake', lat: q.lat, lng: q.lng,
        size: Math.max(0.15, (q.mag || 1) * 0.18),
        color: magColor(q.mag), data: q,
      });
    }
  }
  if (state.layers.pulses) {
    for (const p of state.signals.pulses) {
      points.push({
        kind: 'pulse', lat: p.lat, lng: p.lng,
        size: p.verified ? 0.6 : 0.45,
        color: p.verified ? '#facc15' : categoryColor(p.category),
        data: p,
      });
    }
  }

  globe
    .pointsData(points)
    .pointAltitude((d) => 0.005 + d.size * 0.02)
    .pointRadius((d) => d.size)
    .pointColor((d) => d.color)
    .pointLabel((d) => labelForPoint(d));

  // ISS ring only - no fake arcs to random repos
  const issArr = state.layers.iss && state.signals.iss ? [state.signals.iss] : [];
  globe
    .ringsData(issArr)
    .ringColor(() => (t) => `rgba(250, 204, 21, ${1 - t})`)
    .ringMaxRadius(4).ringPropagationSpeed(2).ringRepeatPeriod(reducedMotion ? 0 : 1500)
    .ringAltitude(0.02)
    .arcsData([]); // arcs killed - they were visual noise, not signal
}

function magColor(mag) {
  if (!mag) return '#f87171';
  if (mag >= 6) return '#7f1d1d';
  if (mag >= 5) return '#dc2626';
  if (mag >= 4) return '#ef4444';
  if (mag >= 3) return '#f97316';
  return '#fbbf24';
}
function categoryColor(cat) {
  const c = {
    ai_launch: '#22d3ee', tech: '#22d3ee', science: '#34d399',
    climate: '#10b981', space: '#facc15', health: '#f472b6',
    culture: '#a78bfa', other: '#94a3b8',
  };
  return c[cat] || c.other;
}

function labelForPoint(d) {
  if (d.kind === 'quake') {
    const q = d.data;
    return `<div><strong>M ${q.mag?.toFixed?.(1) ?? '?'}</strong> · ${esc(q.place || 'Earthquake')}</div>
      <div style="opacity:.7;font-size:11px">${new Date(q.time).toUTCString()}</div>`;
  }
  if (d.kind === 'ai') {
    const t = d.data;
    return `<div><strong>${escapeHtml(t.name)}</strong> · ⭐ ${t.stars}</div>
      <div style="opacity:.8;font-size:11px;max-width:240px">${escapeHtml(t.description || '')}</div>
      <div style="opacity:.6;font-size:10px;margin-top:4px">${escapeHtml(t.language || '')} · <em>position is decorative, not geographic</em></div>`;
    return `<div><strong>${esc(t.name)}</strong> · ⭐ ${t.stars}</div>
      <div style="opacity:.8;font-size:11px;max-width:240px">${esc(t.description || '')}</div>
      <div style="opacity:.6;font-size:10px;margin-top:4px">${esc(t.language || '')} · ${esc(t.ownerLocation || 'unknown')}</div>`;
  }
  if (d.kind === 'pulse') {
    const p = d.data;
    const v = p.verified ? '<span class="tag verified">verified</span> ' : '';
    return `<div>${v}<span class="tag pulse">${esc(p.category)}</span> <strong>${esc(p.title)}</strong></div>
      <div style="opacity:.8;font-size:11px;max-width:240px">${esc(p.description || '')}</div>
      ${p.user ? `<div style="opacity:.6;font-size:10px;margin-top:4px">by ${esc(p.user.login)}</div>` : ''}`;
  }
  return '';
}

globe.onPointClick((d) => {
  if (!d) return;
  globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 1000);
  if (d.kind === 'ai' && d.data?.url) {
    window.open(d.data.url, '_blank', 'noopener');
  } else if (d.kind === 'quake' && d.data?.url) {
    window.open(d.data.url, '_blank', 'noopener');
  } else if (d.kind === 'pulse' && d.data?.url) {
    window.open(d.data.url, '_blank', 'noopener');
  }
});

globe.onGlobeClick(({ lat, lng }) => {
  if ($modal.open) {
    $form.elements.lat.value = lat.toFixed(4);
    $form.elements.lng.value = lng.toFixed(4);
    $hint.textContent = `Location set to ${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
});

// --- Side panel -------------------------------------------------------------
function renderPanel() {
  const tab = state.panelTab;
  let items = [];
  if (tab === 'ai') {
    items = state.signals.ai.map((t) => ({ kind: 'ai', ...t, ts: Date.now() }));
    if (state.signals.aiPending > 0) {
      $panelBody.innerHTML =
        `<div class="empty" style="padding:8px">${state.signals.aiPending} more repos are being geocoded; they'll appear soon.</div>` +
        items.map(itemHtml).join('');
    } else {
      $panelBody.innerHTML = items.length ? items.map(itemHtml).join('') : empty();
    }
    bindItemClicks();
    return;
  }
  if (tab === 'recent') {
    items = [
      ...state.signals.pulses.slice(0, 20).map((p) => ({ kind: 'pulse', ...p, ts: p.createdAt })),
      ...state.signals.quakes.slice(0, 20).map((q) => ({ kind: 'quake', ...q, ts: q.time })),
      ...state.signals.ai.slice(0, 10).map((t) => ({ kind: 'ai', ...t, ts: Date.now() })),
    ].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 40);
  } else if (tab === 'quakes') {
    items = state.signals.quakes.map((q) => ({ kind: 'quake', ...q, ts: q.time }));
  } else if (tab === 'pulses') {
    items = state.signals.pulses.map((p) => ({ kind: 'pulse', ...p, ts: p.createdAt }));
  }

  if (!items.length) {
    $panelBody.innerHTML = `<div class="empty">No data here yet. Try another tab or drop a pulse.</div>`;
    return;
  }

  const noteHtml = tab === 'tech'
    ? `<div class="panel-note">Repo positions on the globe are decorative — GitHub doesn't expose owner geography.</div>`
    : '';
  $panelBody.innerHTML = noteHtml + items.map(itemHtml).join('');
  $panelBody.innerHTML = items.length ? items.map(itemHtml).join('') : empty();
  bindItemClicks();
}
function empty() { return `<div class="empty">No data here yet. Try another tab or drop a pulse.</div>`; }
function bindItemClicks() {
  $panelBody.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', () => {
      const lat = Number(el.dataset.lat); const lng = Number(el.dataset.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        controls.autoRotate = false;
        globe.pointOfView({ lat, lng, altitude: 1.0 }, 1200);
      }
    });
  });
}
function itemHtml(it) {
  if (it.kind === 'quake') {
    return `<div class="item" data-lat="${it.lat}" data-lng="${it.lng}">
      <div class="row">
        <span class="title"><span class="tag quake">M ${it.mag?.toFixed?.(1) ?? '?'}</span> ${esc(it.place || 'Earthquake')}</span>
        <span class="meta">${timeAgo(it.time)}</span>
      </div></div>`;
  }
  if (it.kind === 'ai') {
    return `<div class="item" data-lat="${it.lat}" data-lng="${it.lng}">
      <div class="row">
        <span class="title"><span class="tag ai_launch">${esc(it.language || 'AI')}</span> ${esc(it.name)}</span>
        <span class="meta">⭐ ${it.stars}</span>
      </div>
      <div class="desc">${esc(it.description || '')}</div>
    </div>`;
  }
  if (it.kind === 'pulse') {
    const v = it.verified ? '<span class="tag verified">verified</span> ' : '';
    return `<div class="item" data-lat="${it.lat}" data-lng="${it.lng}">
      <div class="row">
        <span class="title">${v}<span class="tag pulse">${esc(it.category)}</span> ${esc(it.title)}</span>
        <span class="meta">${timeAgo(it.createdAt)}</span>
      </div>
      ${it.description ? `<div class="desc">${esc(it.description)}</div>` : ''}
    </div>`;
  }
  return '';
}
function syncTabs() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.panelTab));
}
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => { state.panelTab = t.dataset.tab; syncTabs(); renderPanel(); });
});
document.querySelectorAll('.layer-btn').forEach((b) => {
  b.addEventListener('click', () => {
    const k = b.dataset.layer;
    state.layers[k] = !state.layers[k];
    b.classList.toggle('active', state.layers[k]);
    renderLayers();
  });
});
$panelToggle.addEventListener('click', () => {
  state.panelCollapsed = !state.panelCollapsed;
  $panel.classList.toggle('collapsed', state.panelCollapsed);
  $panelToggle.classList.toggle('collapsed', state.panelCollapsed);
  $panelToggle.textContent = state.panelCollapsed ? '‹' : '›';
});

// --- Auth -------------------------------------------------------------------
async function loadConfig() {
  try {
    const r = await fetch('/api/config', { credentials: 'include' });
    state.config = await r.json();
  } catch (err) {
    state.config = { authEnabled: false, billingEnabled: false, user: null };
  }
  renderAuthUI();
}
function renderAuthUI() {
  const cfg = state.config || {};
  const u = cfg.user;
  $('login-btn').hidden = Boolean(u) || !cfg.authEnabled;
  $('user-chip').hidden = !u;
  $('alerts-btn').hidden = !u;
  $('admin-btn').hidden = !(u && u.isAdmin);
  if (u) {
    $('user-avatar').src = u.avatar || '';
    $('user-login').textContent = u.login;
    const $b = $('user-badge');
    if (u.isVerified) { $b.textContent = 'verified'; $b.hidden = false; }
    else if (u.isAdmin) { $b.textContent = 'admin'; $b.hidden = false; }
    else $b.hidden = true;
  }
  if ($reviewNote) {
    $reviewNote.textContent = u?.isVerified
      ? 'You are verified - your pulses publish immediately.'
      : 'Pulses go to moderation review before appearing publicly. Verified accounts skip the queue.';
  }
}
$('login-btn').addEventListener('click', () => { window.location.href = '/api/auth/github/start'; });
$('logout-btn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.reload();
});

// --- Add pulse --------------------------------------------------------------
$('add-pulse-btn').addEventListener('click', () => {
  if (state.config?.authEnabled && !state.config?.user) {
    if (confirm('Sign in with GitHub to drop a pulse?')) {
      window.location.href = '/api/auth/github/start';
    }
    return;
  }
  $hint.textContent = 'Tip: close this and click anywhere on the globe to set lat/lng.';
  if (typeof $modal.showModal === 'function') $modal.showModal();
  else $modal.setAttribute('open', '');
});
$('cancel-pulse').addEventListener('click', () => $modal.close());
$form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fd = new FormData($form);
  const body = {
    title: fd.get('title'),
    category: fd.get('category'),
    description: fd.get('description') || null,
    url: fd.get('url') || null,
    lat: Number(fd.get('lat')),
    lng: Number(fd.get('lng')),
  };
  try {
    const res = await fetch('/api/pulses', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (data.status === 'approved') {
      state.signals.pulses.unshift(data);
      renderLayers(); renderPanel();
    }
    $form.reset(); $modal.close();
    $hint.textContent = data.status === 'approved'
      ? 'Published.'
      : 'Submitted for review. You will see it on the globe once approved.';
    setTimeout(() => { $hint.textContent = ''; }, 4000);
  } catch (err) {
    $hint.textContent = `Failed: ${err.message}`;
  }
});

// --- Alerts -----------------------------------------------------------------
$('alerts-btn').addEventListener('click', async () => {
  await refreshAlerts();
  $upgradeCard.hidden = !state.config?.billingEnabled || state.config?.user?.isVerified;
  if (typeof $alertsModal.showModal === 'function') $alertsModal.showModal();
});
$('alerts-close').addEventListener('click', () => $alertsModal.close());
$alertForm.elements.kind.addEventListener('change', (e) => {
  $('ai-config').hidden = e.target.value !== 'ai_launch';
  $('quake-config').hidden = e.target.value !== 'quake';
});
async function refreshAlerts() {
  const r = await fetch('/api/alerts', { credentials: 'include' });
  if (!r.ok) return;
  const items = await r.json();
  $alertsList.innerHTML = items.length
    ? items.map(alertRow).join('')
    : '<div class="empty">No alerts yet.</div>';
  $alertsList.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      await fetch(`/api/alerts/${b.dataset.del}`, { method: 'DELETE', credentials: 'include' });
      refreshAlerts();
    })
  );
}
function alertRow(a) {
  const cfg = a.config || {};
  let summary = '';
  if (a.kind === 'ai_launch') {
    summary = `AI launches · ⭐≥${cfg.minStars || 0}${cfg.language ? ' · ' + esc(cfg.language) : ''}`;
  } else if (a.kind === 'quake') {
    summary = `Quakes near ${cfg.lat?.toFixed?.(1)}, ${cfg.lng?.toFixed?.(1)} · M≥${cfg.minMag || 0} · ${cfg.radiusKm || '?'}km`;
  } else {
    summary = a.kind;
  }
  return `<div class="alert-row">
    <div><div>${summary}</div><div class="meta">${esc(a.email)}</div></div>
    <button class="btn-link" data-del="${a.id}">Remove</button>
  </div>`;
}
$alertForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fd = new FormData($alertForm);
  const kind = fd.get('kind');
  const config = kind === 'ai_launch'
    ? { minStars: Number(fd.get('minStars')) || 0, language: fd.get('language') || null }
    : { lat: Number(fd.get('qLat')), lng: Number(fd.get('qLng')),
        radiusKm: Number(fd.get('radiusKm')), minMag: Number(fd.get('minMag')) };
  const body = { kind, config, email: fd.get('email') };
  const r = await fetch('/api/alerts', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    alert(`Failed: ${e.error || r.status}${e.cap ? ` (limit ${e.cap})` : ''}`);
    return;
  }
  $alertForm.reset();
  refreshAlerts();
});

$('upgrade-btn').addEventListener('click', async () => {
  const r = await fetch('/api/billing/checkout', { method: 'POST', credentials: 'include' });
  const j = await r.json();
  if (j.url) window.location.href = j.url;
  else alert(j.error || 'Checkout failed');
});

// --- Admin queue ------------------------------------------------------------
$('admin-btn').addEventListener('click', async () => {
  await refreshAdmin();
  if (typeof $adminModal.showModal === 'function') $adminModal.showModal();
});
$('admin-close').addEventListener('click', () => $adminModal.close());
async function refreshAdmin() {
  const r = await fetch('/api/admin/pending', { credentials: 'include' });
  if (!r.ok) { $adminList.innerHTML = '<div class="empty">Failed to load.</div>'; return; }
  const items = await r.json();
  $adminList.innerHTML = items.length
    ? items.map(adminRow).join('')
    : '<div class="empty">Queue is empty.</div>';
  $adminList.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', async () => {
      const reason = b.dataset.act === 'reject' ? prompt('Reject reason (optional):') : null;
      await fetch(`/api/admin/pulses/${b.dataset.id}/decision`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: b.dataset.act, reason }),
      });
      refreshAdmin(); pollPulses();
    })
  );
}
function adminRow(p) {
  return `<div class="admin-item">
    <div class="row">
      <strong>${esc(p.title)}</strong>
      <span class="meta">${esc(p.category)} · ${timeAgo(p.createdAt)}</span>
    </div>
    ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
    ${p.url ? `<div class="url">${esc(p.url)}</div>` : ''}
    <div class="submitter">by ${p.user ? esc(p.user.login) : 'anonymous'} · ${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}</div>
    <div class="actions">
      <button class="btn-primary" data-act="approve" data-id="${p.id}">Approve</button>
      <button class="btn-ghost" data-act="reject" data-id="${p.id}">Reject</button>
    </div>
  </div>`;
}

// --- Data fetching ----------------------------------------------------------
async function fetchJson(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function updateCounts() {
  $('count-ai').textContent = state.signals.ai.length;
  $('count-quakes').textContent = state.signals.quakes.length;
  $('count-pulses').textContent = state.signals.pulses.length;
}

async function loadInitial() {
  setStatus('connecting…');
  await loadConfig();
  await Promise.allSettled([
    fetchJson('/api/signals/ai_launches')
      .then((d) => { state.signals.ai = d.located || []; state.signals.aiPending = d.pending || 0; })
      .catch(() => {}),
    fetchJson('/api/signals/quakes').then((d) => state.signals.quakes = d).catch(() => {}),
    fetchJson('/api/signals/iss').then((d) => state.signals.iss = d).catch(() => {}),
    fetchJson('/api/pulses').then((d) => state.signals.pulses = d).catch(() => {}),
  ]);
  updateCounts(); renderLayers(); renderPanel();
  setStatus(`live · ${new Date().toLocaleTimeString()}`, 'live');
  $loading.classList.add('hidden');
  setTimeout(() => $loading.remove(), 700);
}
function setStatus(text, cls) { $status.textContent = text; $status.className = 'status' + (cls ? ' ' + cls : ''); }

async function pollISS() {
  try { state.signals.iss = await fetchJson('/api/signals/iss'); if (state.layers.iss) renderLayers(); }
  catch {}
}
async function pollQuakes() {
  try {
    state.signals.quakes = await fetchJson('/api/signals/quakes');
    updateCounts();
    if (state.layers.quakes) renderLayers();
    if (['recent', 'quakes'].includes(state.panelTab)) renderPanel();
  } catch {}
}
async function pollAI() {
  try {
    const d = await fetchJson('/api/signals/ai_launches');
    state.signals.ai = d.located || [];
    state.signals.aiPending = d.pending || 0;
    updateCounts();
    if (state.layers.ai) renderLayers();
    if (['recent', 'ai'].includes(state.panelTab)) renderPanel();
  } catch {}
}
async function pollPulses() {
  try {
    state.signals.pulses = await fetchJson('/api/pulses');
    updateCounts();
    if (state.layers.pulses) renderLayers();
    if (['recent', 'pulses'].includes(state.panelTab)) renderPanel();
  } catch {}
}

// --- Util -------------------------------------------------------------------
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h';
  const d = Math.floor(h / 24); return d + 'd';
}

// --- Boot -------------------------------------------------------------------
loadInitial();
setInterval(pollISS, 5_000);
setInterval(pollQuakes, 60_000);
setInterval(pollAI, 5 * 60_000);
setInterval(pollPulses, 30_000);

let idleTimer;
function scheduleIdleRotate() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!reducedMotion) controls.autoRotate = true; }, 30_000);
}
['pointerdown', 'wheel', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, scheduleIdleRotate, { passive: true })
);
scheduleIdleRotate();


} // end bootGlobe()
