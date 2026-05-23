// TerraPulse frontend - 3D globe + live signals.
// Globe.gl is exposed as window.Globe via UMD.

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
  layers: { quakes: true, tech: true, iss: true, pulses: true },
  signals: { quakes: [], tech: [], iss: null, pulses: [] },
  panelTab: 'recent',
  panelCollapsed: false,
};

// --- DOM refs ---------------------------------------------------------------
const $globe = document.getElementById('globe-container');
const $loading = document.getElementById('loading');
const $panel = document.getElementById('side-panel');
const $panelBody = document.getElementById('panel-body');
const $panelToggle = document.getElementById('panel-toggle');
const $status = document.getElementById('status-text');
const $modal = document.getElementById('pulse-modal');
const $form = document.getElementById('pulse-form');
const $hint = document.getElementById('pulse-hint');

// --- Globe setup ------------------------------------------------------------
const globe = Globe()
  .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-night.jpg')
  .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-topology.png')
  .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/night-sky.png')
  .atmosphereColor('#22d3ee')
  .atmosphereAltitude(0.22)
  .showGraticules(false)
  (document.getElementById('globe-container'));

// Auto-rotate gently until user interacts
const controls = globe.controls();
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.enableDamping = true;
controls.dampingFactor = 0.08;

let userInteracted = false;
controls.addEventListener('start', () => {
  userInteracted = true;
  controls.autoRotate = false;
});

// Resize handling
function resize() {
  globe.width($globe.clientWidth);
  globe.height($globe.clientHeight);
}
window.addEventListener('resize', resize);
resize();

// Initial camera distance
globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);

// --- Layer renderers --------------------------------------------------------
function renderLayers() {
  // Points: quakes (size by mag), tech repos (cyan), pulses (purple)
  const points = [];

  if (state.layers.quakes) {
    for (const q of state.signals.quakes) {
      points.push({
        kind: 'quake',
        lat: q.lat,
        lng: q.lng,
        size: Math.max(0.15, (q.mag || 1) * 0.18),
        color: magColor(q.mag),
        data: q,
      });
    }
  }

  if (state.layers.tech) {
    for (const t of state.signals.tech) {
      points.push({
        kind: 'tech',
        lat: t.lat,
        lng: t.lng,
        size: 0.35 + Math.min(1.2, Math.log10((t.stars || 1) + 1) * 0.4),
        color: '#22d3ee',
        data: t,
      });
    }
  }

  if (state.layers.pulses) {
    for (const p of state.signals.pulses) {
      points.push({
        kind: 'pulse',
        lat: p.lat,
        lng: p.lng,
        size: 0.5,
        color: categoryColor(p.category),
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

  // ISS as a separate ring
  const issArr = state.layers.iss && state.signals.iss ? [state.signals.iss] : [];
  globe
    .ringsData(issArr)
    .ringColor(() => (t) => `rgba(250, 204, 21, ${1 - t})`)
    .ringMaxRadius(4)
    .ringPropagationSpeed(2)
    .ringRepeatPeriod(1500)
    .ringAltitude(0.02);

  // arcs from ISS to nearest tech repos -> visual delight
  if (state.layers.iss && state.signals.iss && state.layers.tech) {
    const arcs = state.signals.tech.slice(0, 8).map((t) => ({
      startLat: state.signals.iss.lat,
      startLng: state.signals.iss.lng,
      endLat: t.lat,
      endLng: t.lng,
    }));
    globe
      .arcsData(arcs)
      .arcColor(() => ['rgba(250,204,21,0.6)', 'rgba(34,211,238,0.6)'])
      .arcDashLength(0.4)
      .arcDashGap(2)
      .arcDashAnimateTime(2400)
      .arcStroke(0.3)
      .arcAltitudeAutoScale(0.4);
  } else {
    globe.arcsData([]);
  }
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
    tech: '#22d3ee',
    science: '#34d399',
    climate: '#10b981',
    space: '#facc15',
    health: '#f472b6',
    culture: '#a78bfa',
    other: '#94a3b8',
  };
  return c[cat] || c.other;
}

function labelForPoint(d) {
  if (d.kind === 'quake') {
    const q = d.data;
    return `<div><strong>M ${q.mag?.toFixed?.(1) ?? '?'}</strong> · ${escapeHtml(q.place || 'Earthquake')}</div>
      <div style="opacity:.7;font-size:11px">${new Date(q.time).toUTCString()}</div>`;
  }
  if (d.kind === 'tech') {
    const t = d.data;
    return `<div><strong>${escapeHtml(t.name)}</strong> · ⭐ ${t.stars}</div>
      <div style="opacity:.8;font-size:11px;max-width:240px">${escapeHtml(t.description || '')}</div>
      <div style="opacity:.6;font-size:10px;margin-top:4px">${escapeHtml(t.language || '')} · <em>position is decorative, not geographic</em></div>`;
  }
  if (d.kind === 'pulse') {
    const p = d.data;
    return `<div><span class="tag pulse">${escapeHtml(p.category)}</span> <strong>${escapeHtml(p.title)}</strong></div>
      <div style="opacity:.8;font-size:11px;max-width:240px">${escapeHtml(p.description || '')}</div>`;
  }
  return '';
}

// Click → focus & info
globe.onPointClick((d) => {
  if (!d) return;
  globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 1000);
  state.panelTab = d.kind === 'quake' ? 'quakes' : d.kind === 'tech' ? 'tech' : 'pulses';
  syncTabs();
  renderPanel();
});

// Click empty globe → set lat/lng on form (if open) or just show coords
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
  if (tab === 'recent') {
    items = [
      ...state.signals.pulses.slice(0, 20).map((p) => ({ kind: 'pulse', ...p, ts: p.createdAt })),
      ...state.signals.quakes.slice(0, 20).map((q) => ({ kind: 'quake', ...q, ts: q.time })),
      ...state.signals.tech.slice(0, 10).map((t) => ({ kind: 'tech', ...t, ts: Date.now() })),
    ].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 40);
  } else if (tab === 'quakes') {
    items = state.signals.quakes.map((q) => ({ kind: 'quake', ...q, ts: q.time }));
  } else if (tab === 'tech') {
    items = state.signals.tech.map((t) => ({ kind: 'tech', ...t, ts: Date.now() }));
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
  $panelBody.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', () => {
      const lat = Number(el.dataset.lat);
      const lng = Number(el.dataset.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        userInteracted = true;
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
        <span class="title"><span class="tag quake">M ${it.mag?.toFixed?.(1) ?? '?'}</span> ${escapeHtml(it.place || 'Earthquake')}</span>
        <span class="meta">${timeAgo(it.time)}</span>
      </div>
    </div>`;
  }
  if (it.kind === 'tech') {
    return `<div class="item" data-lat="${it.lat}" data-lng="${it.lng}">
      <div class="row">
        <span class="title"><span class="tag tech">${escapeHtml(it.language || 'repo')}</span> ${escapeHtml(it.name)}</span>
        <span class="meta">⭐ ${it.stars}</span>
      </div>
      <div class="desc">${escapeHtml(it.description || '')}</div>
    </div>`;
  }
  if (it.kind === 'pulse') {
    return `<div class="item" data-lat="${it.lat}" data-lng="${it.lng}">
      <div class="row">
        <span class="title"><span class="tag pulse">${escapeHtml(it.category)}</span> ${escapeHtml(it.title)}</span>
        <span class="meta">${timeAgo(it.createdAt)}</span>
      </div>
      ${it.description ? `<div class="desc">${escapeHtml(it.description)}</div>` : ''}
    </div>`;
  }
  return '';
}

function syncTabs() {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === state.panelTab);
  });
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    state.panelTab = t.dataset.tab;
    syncTabs();
    renderPanel();
  });
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

// --- Add pulse modal --------------------------------------------------------
document.getElementById('add-pulse-btn').addEventListener('click', () => {
  $hint.textContent = 'Tip: close this and click anywhere on the globe to set lat/lng.';
  if (typeof $modal.showModal === 'function') $modal.showModal();
  else $modal.setAttribute('open', '');
});
document.getElementById('cancel-pulse').addEventListener('click', () => $modal.close());

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const created = await res.json();
    state.signals.pulses.unshift(created);
    updateCounts();
    renderLayers();
    renderPanel();
    $form.reset();
    $modal.close();
    globe.pointOfView({ lat: created.lat, lng: created.lng, altitude: 1.2 }, 1200);
  } catch (err) {
    $hint.textContent = `Failed: ${err.message}`;
  }
});

// --- Data fetching ----------------------------------------------------------
async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

function updateCounts() {
  document.getElementById('count-quakes').textContent = state.signals.quakes.length;
  document.getElementById('count-tech').textContent = state.signals.tech.length;
  document.getElementById('count-pulses').textContent = state.signals.pulses.length;
}

async function loadInitial() {
  setStatus('connecting…', 'pending');
  const tasks = [
    fetchJson('/api/signals/quakes').then((d) => state.signals.quakes = d).catch((e) => console.warn('quakes:', e.message)),
    fetchJson('/api/signals/tech').then((d) => state.signals.tech = d).catch((e) => console.warn('tech:', e.message)),
    fetchJson('/api/signals/iss').then((d) => state.signals.iss = d).catch((e) => console.warn('iss:', e.message)),
    fetchJson('/api/pulses').then((d) => state.signals.pulses = d).catch((e) => console.warn('pulses:', e.message)),
  ];
  await Promise.allSettled(tasks);
  updateCounts();
  renderLayers();
  renderPanel();
  setStatus(`live · ${new Date().toLocaleTimeString()}`, 'live');
  $loading.classList.add('hidden');
  setTimeout(() => $loading.remove(), 700);
}

function setStatus(text, cls) {
  $status.textContent = text;
  $status.className = 'status' + (cls ? ' ' + cls : '');
}

// Live polling - frequent for ISS, slower for everything else
async function pollISS() {
  try {
    const d = await fetchJson('/api/signals/iss');
    state.signals.iss = d;
    if (state.layers.iss) renderLayers();
  } catch (err) { /* ignore */ }
}
async function pollQuakes() {
  try {
    state.signals.quakes = await fetchJson('/api/signals/quakes');
    updateCounts();
    if (state.layers.quakes) renderLayers();
    if (state.panelTab === 'recent' || state.panelTab === 'quakes') renderPanel();
  } catch (err) { /* ignore */ }
}
async function pollPulses() {
  try {
    state.signals.pulses = await fetchJson('/api/pulses');
    updateCounts();
    if (state.layers.pulses) renderLayers();
    if (state.panelTab === 'recent' || state.panelTab === 'pulses') renderPanel();
  } catch (err) { /* ignore */ }
}

// --- Util -------------------------------------------------------------------
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
setInterval(pollPulses, 30_000);

// Resume gentle rotation if user idle for 30s
let idleTimer;
function scheduleIdleRotate() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { controls.autoRotate = true; }, 30_000);
}
['pointerdown', 'wheel', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, scheduleIdleRotate, { passive: true })
);
scheduleIdleRotate();


} // end bootGlobe()
