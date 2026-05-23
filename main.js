// TerraPulse v3 - static demo with depth: topic clustering, narrative banner,
// time scrubber, animated arrivals, hover graph, pulse rings on hot repos,
// shockwaves on big quakes, ISS trail, starfield, cinematic intro.

// --- Curated AI org -> coordinates map -------------------------------------
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
  'google-deepmind':     { lat: 51.5074, lng: -0.1278,  location: 'London, UK' },
  deepmind:              { lat: 51.5074, lng: -0.1278,  location: 'London, UK' },
  'stability-ai':        { lat: 51.5074, lng: -0.1278,  location: 'London, UK' },
  cohere:                { lat: 43.6532, lng: -79.3832, location: 'Toronto, CA' },
  mistralai:             { lat: 48.8566, lng: 2.3522,   location: 'Paris, FR' },
  ggerganov:             { lat: 42.6977, lng: 23.3219,  location: 'Sofia, BG' },
  'laion-ai':            { lat: 53.5511, lng: 9.9937,   location: 'Hamburg, DE' },

  // Asia
  baai:                  { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  thudm:                 { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  '01-ai':               { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  baidu:                 { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  paddlepaddle:          { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  bytedance:             { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  openbmb:               { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  'skywork-org':         { lat: 39.9042, lng: 116.4074, location: 'Beijing, CN' },
  qwenlm:                { lat: 30.2741, lng: 120.1551, location: 'Hangzhou, CN' },
  alibaba:               { lat: 30.2741, lng: 120.1551, location: 'Hangzhou, CN' },
  'deepseek-ai':         { lat: 30.2741, lng: 120.1551, location: 'Hangzhou, CN' },
  tencent:               { lat: 22.5431, lng: 114.0579, location: 'Shenzhen, CN' },
  internlm:              { lat: 31.2304, lng: 121.4737, location: 'Shanghai, CN' },
  sakanaai:              { lat: 35.6762, lng: 139.6503, location: 'Tokyo, JP' },
  'preferred-networks':  { lat: 35.6762, lng: 139.6503, location: 'Tokyo, JP' },
};

// --- Topic classification ---------------------------------------------------
const TOPICS = [
  { id: 'llm',       color: '#22d3ee', kw: ['llm','gpt','language model','transformer','rag','embedding','tokenizer','prompt','chat','mistral','llama','phi','gemma','qwen','deepseek'] },
  { id: 'vision',    color: '#f472b6', kw: ['vision','image','diffusion','sdxl','sd-','stable-diffusion','yolo','segmentation','detection','video','3d','nerf','gaussian','clip'] },
  { id: 'audio',     color: '#fbbf24', kw: ['audio','voice','tts','stt','whisper','speech','music','sound'] },
  { id: 'agents',    color: '#a78bfa', kw: ['agent','agents','autogpt','crewai','tool-use','planner','workflow','autonomous'] },
  { id: 'framework', color: '#34d399', kw: ['framework','training','inference','engine','kernel','cuda','rocm','quantization','distillation','onnx','mlx','jax','pytorch','tensorflow','vllm','sgl','tgi','ggml'] },
];
function classify(repo) {
  const hay = [repo.name, repo.description || '', ...(repo.topics || [])].join(' ').toLowerCase();
  for (const t of TOPICS) {
    if (t.kw.some((k) => hay.includes(k))) return t;
  }
  return { id: 'other', color: '#94a3b8' };
}

// --- AI keywords (for repo-is-AI filter) ------------------------------------
const AI_KEYWORDS = [
  'llm','gpt','rag','embedding','transformer','agent','multimodal','finetune','inference',
  'pytorch','tensorflow','jax','diffusion','stable-diffusion','machine-learning','deep-learning',
  'neural','huggingface','langchain','llama','mistral','gemma','whisper','tts','voice','vision',
  'rlhf','mlx','onnx','quantization','lora','peft','vector','embeddings',
];
function isAIRepo(r) {
  const hay = [r.name, r.full_name, r.description || '', ...(Array.isArray(r.topics) ? r.topics : [])].join(' ').toLowerCase();
  return AI_KEYWORDS.some((kw) => hay.includes(kw));
}

// --- Globe + state ----------------------------------------------------------
const Globe = window.Globe;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  layers: { ai: true, quakes: true, iss: true },
  raw:    { ai: [], quakes: [], iss: null, issTrail: [] },
  filtered: { ai: [], quakes: [] },
  panelTab: 'ai',
  windowDays: 7,
  hoverOwner: null,
};

const $ = (id) => document.getElementById(id);
const $globe = $('globe-container');
const $loading = $('loading');
const $panel = $('side-panel');
const $panelBody = $('panel-body');
const $panelToggle = $('panel-toggle');
const $status = $('status-text');
const $infoModal = $('info-modal');
const $narBar = $('narrative-bar');
const $narText = $('narrative-text');
const $windowSlider = $('window-slider');
const $windowLabel = $('window-label');

// --- Starfield (static, generated once) -------------------------------------
function drawStars() {
  const cv = $('starfield');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = window.innerWidth * dpr;
  cv.height = window.innerHeight * dpr;
  cv.style.width = window.innerWidth + 'px';
  cv.style.height = window.innerHeight + 'px';
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const count = Math.floor((cv.width * cv.height) / 6000);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * cv.width;
    const y = Math.random() * cv.height;
    const r = Math.random() * 1.3 * dpr;
    const a = 0.25 + Math.random() * 0.65;
    ctx.fillStyle = `rgba(${230 + Math.random() * 25 | 0}, ${230 + Math.random() * 25 | 0}, 255, ${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}
drawStars();
window.addEventListener('resize', () => { drawStars(); resize(); });

// --- Globe ------------------------------------------------------------------
const globe = Globe()
  .globeImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png')
  .backgroundColor('rgba(0,0,0,0)')
  .atmosphereColor('#22d3ee')
  .atmosphereAltitude(0.22)
  .showGraticules(false)
  ($globe);

const controls = globe.controls();
controls.autoRotate = false; // intro takes over first
controls.autoRotateSpeed = 0.3;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.addEventListener('start', () => { controls.autoRotate = false; userInteracted = true; });
let userInteracted = false;

function resize() { globe.width($globe.clientWidth); globe.height($globe.clientHeight); }
resize();

// Cinematic intro: start far + tilted, swing around, settle.
globe.pointOfView({ lat: 60, lng: -150, altitude: 4 }, 0);
setTimeout(() => globe.pointOfView({ lat: 25, lng: 0, altitude: 2.6 }, 3500), 200);
setTimeout(() => { if (!userInteracted && !reducedMotion) controls.autoRotate = true; }, 4200);

// --- Render layers ----------------------------------------------------------
function renderLayers() {
  // Points: AI repos + quakes
  const points = [];

  if (state.layers.ai) {
    for (const t of state.filtered.ai) {
      points.push({
        kind: 'ai', lat: t.lat, lng: t.lng,
        size: 0.35 + Math.min(1.3, Math.log10((t.stars || 1) + 1) * 0.45),
        color: t.topic.color,
        data: t,
      });
    }
  }
  if (state.layers.quakes) {
    for (const q of state.filtered.quakes) {
      points.push({
        kind: 'quake', lat: q.lat, lng: q.lng,
        size: Math.max(0.15, (q.mag || 1) * 0.18),
        color: magColor(q.mag),
        data: q,
      });
    }
  }

  globe
    .pointsData(points)
    .pointAltitude((d) => 0.005 + d.size * 0.02)
    .pointRadius((d) => d.size)
    .pointColor((d) => d.color)
    .pointLabel((d) => labelForPoint(d));

  // Rings: ISS pulse + top-3 hot repos pulse + shockwaves on M>=5 quakes
  const rings = [];
  if (state.layers.iss && state.raw.iss) {
    rings.push({ ...state.raw.iss, kind: 'iss' });
  }
  if (state.layers.ai) {
    const hot = [...state.filtered.ai]
      .filter((r) => r.velocity > 0)
      .sort((a, b) => b.velocity - a.velocity)
      .slice(0, 3);
    for (const r of hot) rings.push({ lat: r.lat, lng: r.lng, kind: 'hot', color: r.topic.color });
  }
  if (state.layers.quakes) {
    for (const q of state.filtered.quakes) {
      if ((q.mag || 0) >= 5) rings.push({ lat: q.lat, lng: q.lng, kind: 'shock' });
    }
  }
  globe
    .ringsData(rings)
    .ringColor((r) => {
      if (r.kind === 'iss')   return (t) => `rgba(250, 204, 21, ${1 - t})`;
      if (r.kind === 'shock') return (t) => `rgba(239, 68, 68, ${0.8 - t * 0.8})`;
      // hot repo
      const c = r.color || '#22d3ee';
      return (t) => hexA(c, 0.7 - t * 0.7);
    })
    .ringMaxRadius((r) => r.kind === 'iss' ? 4 : r.kind === 'shock' ? 6 : 2.5)
    .ringPropagationSpeed((r) => r.kind === 'iss' ? 2 : r.kind === 'shock' ? 3 : 1.5)
    .ringRepeatPeriod((r) => reducedMotion ? 0 : (r.kind === 'iss' ? 1500 : r.kind === 'shock' ? 2400 : 1800))
    .ringAltitude((r) => r.kind === 'iss' ? 0.02 : 0.01);

  // Arcs: animated arrival of newest 6 + hover-owner network
  const arcs = [];
  const recent = [...state.filtered.ai]
    .filter((r) => r.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);
  for (const r of recent) {
    arcs.push({
      kind: 'arrival',
      startLat: r.lat + 25 * (Math.random() - 0.5),
      startLng: r.lng + 35 * (Math.random() - 0.5) + 60,
      endLat: r.lat,
      endLng: r.lng,
      color: r.topic.color,
    });
  }
  if (state.hoverOwner) {
    const sameOwner = state.filtered.ai.filter((r) => r.owner === state.hoverOwner);
    for (let i = 0; i < sameOwner.length; i++) {
      for (let j = i + 1; j < sameOwner.length; j++) {
        arcs.push({
          kind: 'owner',
          startLat: sameOwner[i].lat, startLng: sameOwner[i].lng,
          endLat: sameOwner[j].lat,   endLng: sameOwner[j].lng,
          color: '#ffffff',
        });
      }
    }
  }
  globe
    .arcsData(arcs)
    .arcColor((a) => a.kind === 'owner'
      ? ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.65)']
      : [hexA(a.color, 0.05), hexA(a.color, 0.85)])
    .arcDashLength((a) => a.kind === 'owner' ? 0.08 : 0.5)
    .arcDashGap((a) => a.kind === 'owner' ? 0.12 : 1.5)
    .arcDashAnimateTime((a) => a.kind === 'owner' ? 4000 : 2200)
    .arcStroke((a) => a.kind === 'owner' ? 0.18 : 0.28)
    .arcAltitudeAutoScale(0.4);

  // Paths: ISS orbital trail (last positions)
  const paths = [];
  if (state.layers.iss && state.raw.issTrail.length >= 2) {
    paths.push(state.raw.issTrail.map((p) => [p.lat, p.lng, 0.04]));
  }
  globe
    .pathsData(paths)
    .pathPointLat((p) => p[0])
    .pathPointLng((p) => p[1])
    .pathPointAlt((p) => p[2])
    .pathColor(() => ['rgba(250, 204, 21, 0)', 'rgba(250, 204, 21, 0.6)'])
    .pathStroke(0.6)
    .pathTransitionDuration(0);
}

function magColor(mag) {
  if (!mag) return '#f87171';
  if (mag >= 6) return '#7f1d1d';
  if (mag >= 5) return '#dc2626';
  if (mag >= 4) return '#ef4444';
  if (mag >= 3) return '#f97316';
  return '#fbbf24';
}

function hexA(hex, alpha) {
  // hex like #rrggbb -> rgba(r,g,b,alpha)
  if (!hex || hex[0] !== '#' || hex.length !== 7) return `rgba(34,211,238,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function labelForPoint(d) {
  if (d.kind === 'quake') {
    const q = d.data;
    return `<div><strong>M ${q.mag?.toFixed?.(1) ?? '?'}</strong> · ${esc(q.place || 'Earthquake')}</div>
      <div style="opacity:.7;font-size:11px">${new Date(q.time).toUTCString()}</div>`;
  }
  if (d.kind === 'ai') {
    const t = d.data;
    return `<div><span class="tag ${t.topic.id}" style="color:${t.topic.color}">${t.topic.id}</span> <strong>${esc(t.name)}</strong></div>
      <div style="opacity:.85;font-size:11px;max-width:260px;margin-top:2px">${esc(t.description || '')}</div>
      <div style="opacity:.7;font-size:11px;margin-top:4px">⭐ ${t.stars} · ${t.velocity > 0 ? `+${t.velocity.toFixed(0)}/wk · ` : ''}${esc(t.language || '')} · ${esc(t.ownerLocation || '')}</div>`;
  }
  return '';
}

globe.onPointClick((d) => {
  if (!d) return;
  controls.autoRotate = false;
  globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 1000);
  if (d.data?.url) window.open(d.data.url, '_blank', 'noopener');
});

globe.onPointHover((d) => {
  const owner = (d && d.kind === 'ai') ? d.data.owner : null;
  if (owner !== state.hoverOwner) {
    state.hoverOwner = owner;
    renderLayers();
  }
});

// --- Side panel -------------------------------------------------------------
function renderPanel() {
  const tab = state.panelTab;
  let items = [];
  if (tab === 'ai') {
    items = [...state.filtered.ai].sort((a, b) => b.stars - a.stars).map((t) => ({ kind: 'ai', ...t }));
  } else if (tab === 'quakes') {
    items = [...state.filtered.quakes].sort((a, b) => (b.mag || 0) - (a.mag || 0)).map((q) => ({ kind: 'quake', ...q }));
  }
  $panelBody.innerHTML = items.length
    ? items.map(itemHtml).join('')
    : '<div class="empty">No data in this window. Try widening the time scrubber.</div>';
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
        <span class="title"><span class="tag quake">M ${it.mag?.toFixed?.(1) ?? '?'}</span><span class="title-text">${esc(it.place || 'Earthquake')}</span></span>
        <span class="meta">${timeAgo(it.time)}</span>
      </div></div>`;
  }
  if (it.kind === 'ai') {
    return `<div class="item" data-lat="${it.lat}" data-lng="${it.lng}">
      <div class="row">
        <span class="title"><span class="tag ${it.topic.id}">${it.topic.id}</span><span class="title-text">${esc(it.name)}</span></span>
        <span class="meta">⭐ ${it.stars}</span>
      </div>
      <div class="desc">${esc(it.description || '')}</div>
      <div class="footrow">
        <span>${esc(it.language || '')}</span>
        ${it.velocity > 0 ? `<span class="velocity">+${it.velocity.toFixed(0)}⭐/wk</span>` : ''}
        <span>${esc(it.ownerLocation || '')}</span>
      </div>
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

// --- Time scrubber ----------------------------------------------------------
$windowSlider.addEventListener('input', (ev) => {
  state.windowDays = Number(ev.target.value);
  $windowLabel.textContent = state.windowDays + 'd';
  applyFilter();
  renderLayers();
  renderPanel();
  renderNarrative();
});

function applyFilter() {
  const cutoff = Date.now() - state.windowDays * 86400_000;
  state.filtered.ai = state.raw.ai.filter((r) => !r.createdAt || r.createdAt >= cutoff);
  state.filtered.quakes = state.raw.quakes.filter((q) => !q.time || q.time >= cutoff);
}

// --- Narrative banner -------------------------------------------------------
function renderNarrative() {
  const ai = state.filtered.ai;
  if (!ai.length) {
    $narText.innerHTML = `<strong>This window:</strong> 0 launches found. Widen the slider for more.`;
    return;
  }
  // Top region by city prefix of ownerLocation
  const regionCount = new Map();
  for (const r of ai) {
    const city = (r.ownerLocation || '').split(',')[0].trim() || '—';
    regionCount.set(city, (regionCount.get(city) || 0) + 1);
  }
  const topRegion = [...regionCount.entries()].sort((a, b) => b[1] - a[1])[0];
  // Top repo by velocity (fallback to stars)
  const topRepo = [...ai].sort((a, b) => (b.velocity || 0) - (a.velocity || 0) || b.stars - a.stars)[0];
  // Top topic
  const topicCount = new Map();
  for (const r of ai) topicCount.set(r.topic.id, (topicCount.get(r.topic.id) || 0) + 1);
  const topTopic = [...topicCount.entries()].sort((a, b) => b[1] - a[1])[0];

  $narText.innerHTML =
    `<strong>Last ${state.windowDays}d:</strong> ${ai.length} AI launches · ` +
    `top region <strong>${esc(topRegion[0])}</strong> (${topRegion[1]}) · ` +
    `most <span class="nar-tag" style="background:rgba(34,211,238,0.15);color:#22d3ee">${esc(topTopic[0])}</span> ` +
    `(${topTopic[1]}) · ` +
    `hottest <a href="${esc(topRepo.url)}" target="_blank" rel="noopener">${esc(topRepo.name)}</a> ` +
    `<strong>⭐ ${topRepo.stars}</strong>`;
  $narBar.hidden = false;
}

// --- Data fetching ----------------------------------------------------------
const CACHE_KEY_AI = 'tp.ai.v3';
const CACHE_TTL_AI = 10 * 60_000;

async function fetchAILaunches() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_AI);
    if (raw) {
      const c = JSON.parse(raw);
      if (Date.now() - c.t < CACHE_TTL_AI) {
        // re-hydrate topic objects (lost color refs after JSON roundtrip is fine, we re-classify)
        return c.v.map((r) => ({ ...r, topic: classify(r) }));
      }
    }
  } catch {}

  // Pull last 30 days for the scrubber range.
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const u = new URL('https://api.github.com/search/repositories');
  u.searchParams.set('q', `created:>${since} stars:>=20 topic:machine-learning OR topic:llm OR topic:ai`);
  u.searchParams.set('sort', 'stars');
  u.searchParams.set('order', 'desc');
  u.searchParams.set('per_page', '100');

  const res = await fetch(u, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`github ${res.status}`);
  const j = await res.json();

  const repos = (j.items || [])
    .filter(isAIRepo)
    .map((r) => {
      const owner = (r.owner.login || '').toLowerCase();
      const loc = ORG_LOCATIONS[owner];
      if (!loc) return null;
      const createdAt = new Date(r.created_at).getTime();
      const ageDays = Math.max(1, (Date.now() - createdAt) / 86400_000);
      const velocity = r.stargazers_count / ageDays * 7; // stars per week
      return {
        id: r.id,
        name: r.full_name,
        description: r.description,
        stars: r.stargazers_count,
        language: r.language,
        url: r.html_url,
        owner: r.owner.login,
        ownerAvatar: r.owner.avatar_url,
        topics: r.topics,
        lat: loc.lat,
        lng: loc.lng,
        ownerLocation: loc.location,
        createdAt,
        velocity,
        topic: classify({ name: r.name, description: r.description, topics: r.topics }),
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

function pushIssTrail(p) {
  state.raw.issTrail.push(p);
  if (state.raw.issTrail.length > 60) state.raw.issTrail.shift();
}

function updateCounts() {
  $('count-ai').textContent = state.filtered.ai.length;
  $('count-quakes').textContent = state.filtered.quakes.length;
}
function setStatus(text, cls) { $status.textContent = text; $status.className = 'status' + (cls ? ' ' + cls : ''); }

async function loadInitial() {
  setStatus('connecting…');
  await Promise.allSettled([
    fetchAILaunches().then((d) => state.raw.ai = d).catch((e) => console.warn('ai:', e.message)),
    fetchQuakes().then((d) => state.raw.quakes = d).catch((e) => console.warn('quakes:', e.message)),
    fetchISS().then((d) => { state.raw.iss = d; pushIssTrail(d); }).catch((e) => console.warn('iss:', e.message)),
  ]);
  applyFilter();
  updateCounts();
  renderLayers();
  renderPanel();
  renderNarrative();
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
  try {
    const d = await fetchISS();
    state.raw.iss = d;
    pushIssTrail(d);
    if (state.layers.iss) renderLayers();
  } catch {}
}, 5_000);

setInterval(async () => {
  try {
    state.raw.quakes = await fetchQuakes();
    applyFilter(); updateCounts();
    if (state.layers.quakes) renderLayers();
    if (state.panelTab === 'quakes') renderPanel();
    renderNarrative();
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
