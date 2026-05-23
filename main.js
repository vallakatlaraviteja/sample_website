// TerraPulse - static demo for GitHub Pages.
// 100% client-side: hits the GitHub Search API, USGS feed, and wheretheiss.at
// directly from the browser. No backend required.

// --- Curated AI org -> coordinates map -------------------------------------
// This is the demo's truth source for owner geocoding. ~40 well-known AI
// labs / authors. Repos from unknown owners are NOT shown - by design, we
// never fabricate coordinates.
const ORG_LOCATIONS = {
  // United States
  openai:                { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  anthropic:             { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  'xai-org':             { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  'perplexity-ai':       { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  langchain:             { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  'langchain-ai':        { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  llamaindex:            { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  'run-llama':           { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  togethercomputer:      { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  replicate:             { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  crewaiinc:             { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  karpathy:              { lat: 37.7749, lng: -122.4194, location: 'San Francisco, US' },
  ollama:                { lat: 37.4419, lng: -122.1430, location: 'Palo Alto, US' },
  'vllm-project':        { lat: 37.8716, lng: -122.2727, location: 'Berkeley, US' },
  google:                { lat: 37.4220, lng: -122.0841, location: 'Mountain View, US' },
  'google-research':     { lat: 37.4220, lng: -122.0841, location: 'Mountain View, US' },
  pytorch:               { lat: 37.4220, lng: -122.0841, location: 'Mountain View, US' },
  tensorflow:            { lat: 37.4220, lng: -122.0841, location: 'Mountain View, US' },
  meta:                  { lat: 37.4530, lng: -122.1817, location: 'Menlo Park, US' },
  facebookresearch:      { lat: 37.4530, lng: -122.1817, location: 'Menlo Park, US' },
  'facebook-research':   { lat: 37.4530, lng: -122.1817, location: 'Menlo Park, US' },
  'meta-llama':          { lat: 37.4530, lng: -122.1817, location: 'Menlo Park, US' },
  microsoft:             { lat: 47.6740, lng: -122.1215, location: 'Redmond, US' },
  nvidia:                { lat: 37.3541, lng: -121.9552, location: 'Santa Clara, US' },
  apple:                 { lat: 37.3230, lng: -122.0322, location: 'Cupertino, US' },
  'ml-explore':          { lat: 37.3230, lng: -122.0322, location: 'Cupertino, US' },
  adobe:                 { lat: 37.3382, lng: -121.8863, location: 'San Jose, US' },
  'adobe-research':      { lat: 37.3382, lng: -121.8863, location: 'San Jose, US' },
  amazon:                { lat: 47.6062, lng: -122.3321, location: 'Seattle, US' },
  awslabs:               { lat: 47.6062, lng: -122.3321, location: 'Seattle, US' },
  ibm:                   { lat: 41.0998, lng: -73.7220, location: 'Armonk, US' },
  eleutherai:            { lat: 42.3601, lng: -71.0589, location: 'Boston, US' },
  'modal-labs':          { lat: 40.7128, lng: -74.0060, location: 'New York, US' },
  huggingface:           { lat: 40.7128, lng: -74.0060, location: 'New York, US' },

  // Europe
  'google-deepmind':     { lat: 51.5074, lng: -0.1278,   location: 'London, UK' },
  deepmind:              { lat: 51.5074, lng: -0.1278,   location: 'London, UK' },
  'stability-ai':        { lat: 51.5074, lng: -0.1278,   location: 'London, UK' },
  cohere:                { lat: 43.6532, lng: -79.3832,  location: 'Toronto, CA' },
  mistralai:             { lat: 48.8566, lng: 2.3522,    location: 'Paris, FR' },
  ggerganov:             { lat: 42.6977, lng: 23.3219,   location: 'Sofia, BG' },
  'laion-ai':            { lat: 53.5511, lng: 9.9937,    location: 'Hamburg, DE' },

  // Asia
  baai:                  { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  thudm:                 { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  '01-ai':               { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  baidu:                 { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  paddlepaddle:          { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  bytedance:             { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  openbmb:               { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  'skywork-org':         { lat: 39.9042, lng: 116.4074,  location: 'Beijing, CN' },
  'qwenlm':              { lat: 30.2741, lng: 120.1551,  location: 'Hangzhou, CN' },
  alibaba:               { lat: 30.2741, lng: 120.1551,  location: 'Hangzhou, CN' },
  'deepseek-ai':         { lat: 30.2741, lng: 120.1551,  location: 'Hangzhou, CN' },
  tencent:               { lat: 22.5431, lng: 114.0579,  location: 'Shenzhen, CN' },
  'internlm':            { lat: 31.2304, lng: 121.4737,  location: 'Shanghai, CN' },
  sakanaai:              { lat: 35.6762, lng: 139.6503,  location: 'Tokyo, JP' },
  'preferred-networks':  { lat: 35.6762, lng: 139.6503,  location: 'Tokyo, JP' },
};

// --- Setup ------------------------------------------------------------------
const Globe = window.Globe;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  layers: { ai: true, quakes: true, iss: true },
  signals: { ai: [], quakes: [], iss: null },
  panelTab: 'ai',
};

const $ = (id) => document.getElementById(id);
const $globe = $('globe-container');
const $loading = $('loading');
const $panel = $('side-panel');
const $panelBody = $('panel-body');
const $panelToggle = $('panel-toggle');
const $status = $('status-text');
const $infoModal = $('info-modal');

// --- Globe ------------------------------------------------------------------
const globe = Globe()
  .globeImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png')
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
window.addEventListener('resize', resize);
resize();
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

  globe
    .pointsData(points)
    .pointAltitude((d) => 0.005 + d.size * 0.02)
    .pointRadius((d) => d.size)
    .pointColor((d) => d.color)
    .pointLabel((d) => labelForPoint(d));

  const issArr = state.layers.iss && state.signals.iss ? [state.signals.iss] : [];
  globe
    .ringsData(issArr)
    .ringColor(() => (t) => `rgba(250, 204, 21, ${1 - t})`)
    .ringMaxRadius(4).ringPropagationSpeed(2).ringRepeatPeriod(reducedMotion ? 0 : 1500)
    .ringAltitude(0.02);
}

function magColor(mag) {
  if (!mag) return '#f87171';
  if (mag >= 6) return '#7f1d1d';
  if (mag >= 5) return '#dc2626';
  if (mag >= 4) return '#ef4444';
  if (mag >= 3) return '#f97316';
  return '#fbbf24';
}

function labelForPoint(d) {
  if (d.kind === 'quake') {
    const q = d.data;
    return `<div><strong>M ${q.mag?.toFixed?.(1) ?? '?'}</strong> · ${esc(q.place || 'Earthquake')}</div>
      <div style="opacity:.7;font-size:11px">${new Date(q.time).toUTCString()}</div>`;
  }
  if (d.kind === 'ai') {
    const t = d.data;
    return `<div><strong>${esc(t.name)}</strong> · ⭐ ${t.stars}</div>
      <div style="opacity:.85;font-size:11px;max-width:240px">${esc(t.description || '')}</div>
      <div style="opacity:.6;font-size:10px;margin-top:4px">${esc(t.language || '')} · ${esc(t.ownerLocation || '')}</div>`;
  }
  return '';
}

globe.onPointClick((d) => {
  if (!d) return;
  globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 1000);
  if (d.data?.url) window.open(d.data.url, '_blank', 'noopener');
});

// --- Side panel -------------------------------------------------------------
function renderPanel() {
  const tab = state.panelTab;
  let items = [];
  if (tab === 'ai') {
    items = state.signals.ai.map((t) => ({ kind: 'ai', ...t }));
  } else if (tab === 'quakes') {
    items = state.signals.quakes.map((q) => ({ kind: 'quake', ...q }));
  }
  $panelBody.innerHTML = items.length
    ? items.map(itemHtml).join('')
    : '<div class="empty">No data here yet.</div>';
  $panelBody.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', () => {
      const lat = Number(el.dataset.lat); const lng = Number(el.dataset.lng);
      controls.autoRotate = false;
      globe.pointOfView({ lat, lng, altitude: 1.0 }, 1200);
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
        <span class="title"><span class="tag">${esc(it.language || 'AI')}</span> ${esc(it.name)}</span>
        <span class="meta">⭐ ${it.stars}</span>
      </div>
      <div class="desc">${esc(it.description || '')}</div>
      <div class="loc">${esc(it.ownerLocation || '')}</div>
    </div>`;
  }
  return '';
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    state.panelTab = t.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === state.panelTab));
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

let panelCollapsed = false;
$panelToggle.addEventListener('click', () => {
  panelCollapsed = !panelCollapsed;
  $panel.classList.toggle('collapsed', panelCollapsed);
  $panelToggle.classList.toggle('collapsed', panelCollapsed);
  $panelToggle.textContent = panelCollapsed ? '‹' : '›';
});

$('info-btn').addEventListener('click', () => {
  if (typeof $infoModal.showModal === 'function') $infoModal.showModal();
});
$('info-close').addEventListener('click', () => $infoModal.close());

// --- Data fetching ----------------------------------------------------------
const AI_KEYWORDS = [
  'llm','gpt','rag','embedding','transformer','agent','multimodal','finetune',
  'inference','pytorch','tensorflow','jax','diffusion','stable-diffusion',
  'machine-learning','deep-learning','neural','huggingface','langchain',
  'llama','mistral','gemma','whisper','tts','voice','vision','rlhf',
  'mlx','onnx','quantization','lora','peft','vector','embeddings',
];

function isAIRepo(repo) {
  const hay = [
    repo.name, repo.full_name, repo.description || '',
    ...(Array.isArray(repo.topics) ? repo.topics : []),
  ].join(' ').toLowerCase();
  return AI_KEYWORDS.some((kw) => hay.includes(kw));
}

const CACHE_KEY_AI = 'tp.ai.v1';
const CACHE_TTL_AI = 10 * 60_000; // 10 min

async function fetchAILaunches() {
  // localStorage cache to avoid burning the anonymous GitHub API limit on reload.
  try {
    const raw = localStorage.getItem(CACHE_KEY_AI);
    if (raw) {
      const c = JSON.parse(raw);
      if (Date.now() - c.t < CACHE_TTL_AI) return c.v;
    }
  } catch {}

  const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const u = new URL('https://api.github.com/search/repositories');
  u.searchParams.set('q', `created:>${since} stars:>=30 topic:machine-learning OR topic:llm OR topic:ai`);
  u.searchParams.set('sort', 'stars');
  u.searchParams.set('order', 'desc');
  u.searchParams.set('per_page', '50');

  const res = await fetch(u, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const j = await res.json();

  const repos = (j.items || [])
    .filter(isAIRepo)
    .map((r) => {
      const owner = (r.owner.login || '').toLowerCase();
      const loc = ORG_LOCATIONS[owner];
      if (!loc) return null;
      return {
        id: r.id,
        name: r.full_name,
        description: r.description,
        stars: r.stargazers_count,
        language: r.language,
        url: r.html_url,
        owner: r.owner.login,
        lat: loc.lat,
        lng: loc.lng,
        ownerLocation: loc.location,
      };
    })
    .filter(Boolean);

  try { localStorage.setItem(CACHE_KEY_AI, JSON.stringify({ t: Date.now(), v: repos })); } catch {}
  return repos;
}

async function fetchQuakes() {
  const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
  if (!r.ok) throw new Error(`usgs ${r.status}`);
  const j = await r.json();
  return j.features.map((f) => ({
    id: f.id,
    mag: f.properties.mag,
    place: f.properties.place,
    time: f.properties.time,
    url: f.properties.url,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    depth: f.geometry.coordinates[2],
  }));
}

async function fetchISS() {
  const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
  if (!r.ok) throw new Error(`iss ${r.status}`);
  const j = await r.json();
  return { lat: Number(j.latitude), lng: Number(j.longitude), timestamp: j.timestamp * 1000 };
}

function updateCounts() {
  $('count-ai').textContent = state.signals.ai.length;
  $('count-quakes').textContent = state.signals.quakes.length;
}
function setStatus(text, cls) { $status.textContent = text; $status.className = 'status' + (cls ? ' ' + cls : ''); }

async function loadInitial() {
  setStatus('connecting…');
  await Promise.allSettled([
    fetchAILaunches().then((d) => state.signals.ai = d).catch((e) => console.warn('ai:', e.message)),
    fetchQuakes().then((d) => state.signals.quakes = d).catch((e) => console.warn('quakes:', e.message)),
    fetchISS().then((d) => state.signals.iss = d).catch((e) => console.warn('iss:', e.message)),
  ]);
  updateCounts(); renderLayers(); renderPanel();
  setStatus(`live · ${new Date().toLocaleTimeString()}`, 'live');
  $loading.classList.add('hidden');
  setTimeout(() => $loading.remove(), 700);
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
setInterval(async () => {
  try { state.signals.iss = await fetchISS(); if (state.layers.iss) renderLayers(); } catch {}
}, 5_000);
setInterval(async () => {
  try {
    state.signals.quakes = await fetchQuakes();
    updateCounts();
    if (state.layers.quakes) renderLayers();
    if (state.panelTab === 'quakes') renderPanel();
  } catch {}
}, 60_000);

let idleTimer;
function scheduleIdleRotate() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!reducedMotion) controls.autoRotate = true; }, 30_000);
}
['pointerdown', 'wheel', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, scheduleIdleRotate, { passive: true })
);
scheduleIdleRotate();
