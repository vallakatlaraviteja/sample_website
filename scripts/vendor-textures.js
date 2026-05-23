#!/usr/bin/env node
// Self-host globe textures so we don't depend on unpkg at runtime.
// Idempotent: skips if files exist. Always exits 0 so install never fails.

const fs = require('fs');
const path = require('path');

const TEX_DIR = path.join(__dirname, '..', 'public', 'textures');
const ASSETS = [
  {
    name: 'earth-night.jpg',
    url: 'https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg',
  },
  {
    name: 'earth-topology.png',
    url: 'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png',
  },
  {
    name: 'night-sky.png',
    url: 'https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png',
  },
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  fs.mkdirSync(TEX_DIR, { recursive: true });
  for (const a of ASSETS) {
    const dest = path.join(TEX_DIR, a.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1024) {
      console.log(`[textures] keep ${a.name}`);
      continue;
    }
    try {
      const size = await download(a.url, dest);
      console.log(`[textures] fetched ${a.name} (${size} bytes)`);
    } catch (err) {
      console.warn(`[textures] failed ${a.name}: ${err.message} (will fall back to CDN)`);
    }
  }
}

main().catch((err) => {
  console.warn('[textures] error:', err.message);
  process.exit(0);
});
