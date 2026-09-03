/**
 * prismicon core — framework-free 3D identicon engine.
 *
 * Derivation spec v1 (FROZEN — do not reorder draws):
 *   seed -> normalize (trim + lowercase) -> cyrb53 hash -> mulberry32 PRNG
 *   draw order: n, solidType, finish, prop, axisMode, speedMag, speedSign,
 *               phase, precess, zSpeedMag, zSpeedSign, phase2
 *   hue = PALETTE[hash % 12]; hue2 = PALETTE[(idx + 4) % 12]
 *
 * Changing the draw order, palette length, or normalization is a breaking
 * change to every user's identity and requires a new spec version.
 */

const TAU = Math.PI * 2;
const F = 150; // perspective focal length

export const SPEC_VERSION = 'v1';
export const SIDE_NAMES = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' };
export const SOLID_NAMES = ['prism', 'pyramid', 'bipyramid', 'antiprism'];
export const FINISH_NAMES = ['shaded', 'two-tone', 'wireframe'];
export const PALETTE = [8, 25, 45, 95, 145, 170, 200, 220, 250, 275, 300, 330];
export const STATES = ['idle', 'working', 'waiting', 'done', 'error', 'thinking', 'sending', 'receiving', 'sleeping'];

const PORTRAITS = [
  { ax: 0.30, ay: 0.42, az: 0 }, // prism
  { ax: 0.20, ay: 1.05, az: 0 }, // pyramid — profile, apex visible
  { ax: 0.15, ay: 1.00, az: 0 }, // bipyramid — full diamond silhouette
  { ax: 0.50, ay: 0.35, az: 0 }  // antiprism — reveals the twist band
];

const STATUS_RING = {
  done:    { color: 'hsl(145 50% 42%)', dash: null,    cap: null },
  error:   { color: 'hsl(4 70% 50%)',   dash: '7 5',   cap: null },
  waiting: { color: 'hsl(42 80% 44%)',  dash: '0.1 9', cap: 'round' }
};

const RING_FOR_STATE = { done: 'done', error: 'error', waiting: 'waiting' };

// ---------------------------------------------------------------- hashing

function cyrb53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeSeed(seed) {
  return String(seed).trim().toLowerCase();
}

// ---------------------------------------------------------------- spec v1

export function deriveV1(seed) {
  const norm = normalizeSeed(seed);
  const hash = cyrb53(norm);
  const r = mulberry32(hash);
  const n = 3 + Math.floor(r() * 4);
  const solidType = Math.floor(r() * 4);
  const finish = Math.floor(r() * 3);
  const prop = r() < 0.5 ? 0.75 : 1.3;
  const axisMode = Math.floor(r() * 3);
  const speed = (0.35 + r() * 0.5) * (r() < 0.5 ? 1 : -1);
  const phase = r() * TAU;
  const precess = axisMode < 2 && r() < 0.4;
  const zSpeed = (0.1 + r() * 0.15) * (r() < 0.5 ? 1 : -1);
  const phase2 = r() * TAU;
  const hueIdx = hash % PALETTE.length;
  return {
    spec: SPEC_VERSION, seed: norm, hash,
    n, solidType, finish, prop, axisMode, speed, phase, precess, zSpeed, phase2,
    hue: PALETTE[hueIdx], hue2: PALETTE[(hueIdx + 4) % PALETTE.length]
  };
}

/** Human-readable anatomy, e.g. "pentagon bipyramid, two-tone, tall". */
export function describeParams(p) {
  return SIDE_NAMES[p.n] + ' ' + SOLID_NAMES[p.solidType] + ', ' +
    FINISH_NAMES[p.finish] + (p.prop < 1 ? ', squat' : ', tall');
}

// ---------------------------------------------------------------- geometry

function buildSolid(type, n, prop) {
  const V = [], faces = [];
  const ring = (r, z, off) => {
    const start = V.length;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (off || 0) + (i * TAU) / n;
      V.push([Math.cos(a) * r, Math.sin(a) * r, z * prop]);
    }
    return start;
  };
  const seq = (s) => Array.from({ length: n }, (_, i) => s + i);
  if (type === 0) {
    const f = ring(25, 10), b = ring(25, -10);
    faces.push({ v: seq(f), cap: true }, { v: seq(b), cap: true });
    for (let i = 0; i < n; i++) faces.push({ v: [f + i, f + (i + 1) % n, b + (i + 1) % n, b + i], cap: false });
  } else if (type === 1) {
    const b = ring(26, -9);
    V.push([0, 0, 19 * prop]);
    const apex = V.length - 1;
    faces.push({ v: seq(b), cap: true });
    for (let i = 0; i < n; i++) faces.push({ v: [b + i, b + (i + 1) % n, apex], cap: false });
  } else if (type === 2) {
    const m = ring(24, 0);
    V.push([0, 0, 17 * prop]); V.push([0, 0, -17 * prop]);
    const at = V.length - 2, ab = V.length - 1;
    for (let i = 0; i < n; i++) {
      faces.push({ v: [m + i, m + (i + 1) % n, at], cap: false });
      faces.push({ v: [m + i, m + (i + 1) % n, ab], cap: true });
    }
  } else {
    const t = ring(24, 9), b = ring(24, -9, Math.PI / n);
    faces.push({ v: seq(t), cap: true }, { v: seq(b), cap: true });
    for (let i = 0; i < n; i++) {
      faces.push({ v: [t + i, b + i, t + (i + 1) % n], cap: false });
      faces.push({ v: [t + (i + 1) % n, b + i, b + (i + 1) % n], cap: false });
    }
  }
  const c = [0, 0, 0];
  V.forEach((v) => { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; });
  c[0] /= V.length; c[1] /= V.length; c[2] /= V.length;
  return { V, faces, center: c };
}

// ---------------------------------------------------------------- math

function rot3(v, ax, ay, az) {
  let x = v[0], y = v[1], z = v[2];
  let c = Math.cos(az), s = Math.sin(az);
  const x1 = x * c - y * s, y1 = x * s + y * c;
  c = Math.cos(ay); s = Math.sin(ay);
  const x2 = x1 * c + z * s, z1 = -x1 * s + z * c;
  c = Math.cos(ax); s = Math.sin(ax);
  return [x2, y1 * c - z1 * s, y1 * s + z1 * c];
}

function lerpHue(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

function angDiff(target, cur) {
  let d = (target - cur) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function wrapAngle(a) {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

// ---------------------------------------------------------------- rendering

function shadeFor(dark) {
  return dark
    ? { base: 40, range: 26, edge: 78, wire: 62 }
    : { base: 30, range: 28, edge: 24, wire: 45 };
}

function renderInner(p, geo, o, opts) {
  const shade = shadeFor(!!opts.dark);
  const off = opts.dx || 0;
  const hueMix = opts.hueMix;
  const pts3 = geo.V.map((v) => rot3(v, o.ax, o.ay, o.az));
  const proj = pts3.map((v) => {
    const s = F / (F - v[2]);
    return [(50 + off + v[0] * s).toFixed(1), (50 + v[1] * s).toFixed(1)];
  });
  const ink = (h, L) => 'hsl(' + Math.round(h) + ' 52% ' + Math.round(L) + '%)';
  if (p.finish === 2) {
    let d = '';
    geo.faces.forEach((f) => {
      for (let i = 0; i < f.v.length; i++) {
        const a = f.v[i], b = f.v[(i + 1) % f.v.length];
        d += 'M' + proj[a][0] + ' ' + proj[a][1] + ' L' + proj[b][0] + ' ' + proj[b][1] + ' ';
      }
    });
    return '<path d="' + d + '" fill="none" stroke="' + ink(hueMix != null ? hueMix : p.hue, shade.wire) +
      '" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  const rc = rot3(geo.center, o.ax, o.ay, o.az);
  const faces = geo.faces.map((f) => {
    const idx = f.v;
    const c = [0, 0, 0];
    idx.forEach((i) => { c[0] += pts3[i][0]; c[1] += pts3[i][1]; c[2] += pts3[i][2]; });
    c[0] /= idx.length; c[1] /= idx.length; c[2] /= idx.length;
    const u = [pts3[idx[1]][0] - pts3[idx[0]][0], pts3[idx[1]][1] - pts3[idx[0]][1], pts3[idx[1]][2] - pts3[idx[0]][2]];
    const v = [pts3[idx[2]][0] - pts3[idx[0]][0], pts3[idx[2]][1] - pts3[idx[0]][1], pts3[idx[2]][2] - pts3[idx[0]][2]];
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    const ox = c[0] - rc[0], oy = c[1] - rc[1], oz = c[2] - rc[2];
    if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const m = Math.hypot(nx, ny, nz) || 1;
    return { idx, z: c[2], nz: nz / m, cap: f.cap };
  });
  faces.sort((a, b) => a.z - b.z);
  return faces.map((f) => {
    let h = p.finish === 1 && f.cap ? p.hue2 : p.hue;
    if (hueMix != null) h = hueMix;
    const L = shade.base + shade.range * Math.max(0.12, f.nz);
    const d = 'M' + f.idx.map((i) => proj[i][0] + ' ' + proj[i][1]).join(' L') + ' Z';
    return '<path d="' + d + '" fill="' + ink(h, L) + '" stroke="' + ink(h, shade.edge) +
      '" stroke-width="1" stroke-linejoin="round"/>';
  }).join('');
}

function ringMarkup(status, animate) {
  if (!status) return '';
  const st = STATUS_RING[status];
  return '<circle cx="50" cy="50" r="42" fill="none" stroke="' + st.color + '" stroke-width="4.5"' +
    (st.dash ? ' stroke-dasharray="' + st.dash + '"' : '') +
    (st.cap ? ' stroke-linecap="' + st.cap + '"' : '') +
    (animate ? ' style="animation:prismicon-sfade 0.5s ease 0.3s both"' : '') + '/>';
}

function describeInstance(seedRaw, p, kind, state) {
  let s = seedRaw + ': ' + describeParams(p);
  if (kind === 'agent') s += ', ' + (state || 'idle');
  return s;
}

/**
 * Pure static render — safe on the server. Returns a complete SVG string in
 * the identity's portrait pose, with the state's persistent ring if any.
 */
export function renderStaticSVG(seed, opts = {}) {
  const size = opts.size || 64;
  const kind = opts.kind || 'agent';
  let p = deriveV1(seed);
  if (size < 28 && p.finish === 2) p = { ...p, finish: 0 };
  const geo = buildSolid(p.solidType, p.n, p.prop);
  const status = kind === 'agent' ? RING_FOR_STATE[opts.state] || null : null;
  const inner = renderInner(p, geo, PORTRAITS[p.solidType], { dark: opts.dark });
  return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size +
    '" role="img" aria-label="' + describeInstance(String(seed), p, kind, opts.state) + '">' +
    '<g>' + inner + '</g><g>' + ringMarkup(status, false) + '</g></svg>';
}

// ---------------------------------------------------------------- runtime

let engine = null;

function getEngine() {
  if (engine) return engine;
  const reduced = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const instances = [];
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const inst = instances.find((x) => x.svg === e.target);
          if (inst) inst.visible = e.isIntersecting;
        });
      })
    : null;
  if (typeof document !== 'undefined' && !document.getElementById('prismicon-style')) {
    const style = document.createElement('style');
    style.id = 'prismicon-style';
    style.textContent = '@keyframes prismicon-sfade{from{opacity:0}}' +
      '@media (prefers-reduced-motion:reduce){.prismicon svg *{animation:none!important}}';
    document.head.appendChild(style);
  }
  let running = false, lastT = 0;
  function loop(now) {
    if (!instances.length) { running = false; return; }
    requestAnimationFrame(loop);
    if (now - lastT < 33) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    const tSec = now / 1000;
    lastT = now;
    for (let i = 0; i < instances.length; i++) step(instances[i], dt, tSec);
  }
  function ensureRunning() {
    if (!running && !reduced && instances.length) {
      running = true; lastT = 0;
      requestAnimationFrame(loop);
    }
  }
  function step(inst, dt, tSec) {
    if (!inst.visible) return;
    const p = inst.p, o = inst.ori;
    let dirty = false, hueMix = null, dx = 0;
    if (inst.state === 'working') {
      const k = Math.min(1, dt * 3);
      if (p.axisMode === 0) {
        o.ay = wrapAngle(o.ay + p.speed * dt); o.ax += (0.18 - o.ax) * k;
        if (p.precess) o.az = wrapAngle(o.az + p.zSpeed * dt); else o.az += angDiff(0, o.az) * k;
      } else if (p.axisMode === 1) {
        o.ax = wrapAngle(o.ax + p.speed * dt); o.ay += (0.18 - o.ay) * k;
        if (p.precess) o.az = wrapAngle(o.az + p.zSpeed * dt); else o.az += angDiff(0, o.az) * k;
      } else {
        o.az = wrapAngle(o.az + p.speed * dt); o.ax += (0.42 - o.ax) * k; o.ay += angDiff(0, o.ay) * k;
      }
      dirty = true;
    } else if (inst.state === 'waiting') {
      const port = PORTRAITS[p.solidType];
      const tx = port.ax + Math.sin(tSec * 0.8 + p.phase) * 0.05;
      const ty = port.ay + Math.sin(tSec * 0.55 + p.phase2) * 0.10;
      const k = Math.min(1, dt * 3.5);
      o.ax += angDiff(tx, o.ax) * k;
      o.ay += angDiff(ty, o.ay) * k;
      o.az += angDiff(port.az, o.az) * k;
      dirty = true;
    } else if (inst.state === 'settling') {
      const tgt = PORTRAITS[p.solidType];
      const k = Math.min(1, dt * 4.5);
      const da = angDiff(tgt.ax, o.ax), db = angDiff(tgt.ay, o.ay), dc = angDiff(tgt.az, o.az);
      o.ax += da * k; o.ay += db * k; o.az += dc * k;
      if (Math.abs(da) < 0.015 && Math.abs(db) < 0.015 && Math.abs(dc) < 0.015) {
        o.ax = tgt.ax; o.ay = tgt.ay; o.az = tgt.az;
        inst.state = 'idle';
      }
      dirty = true;
    }
    if (inst.flash != null) {
      inst.flashT += dt;
      const t = inst.flashT;
      if (t < 1.4) {
        const s = t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 3);
        hueMix = lerpHue(p.hue, inst.flash, 0.75 * s);
        if (inst.shake) dx = Math.sin(t * 36) * 3.2 * Math.exp(-t * 6);
        dirty = true;
      } else { inst.flash = null; dirty = true; }
    }
    if (dirty) inst.g.innerHTML = renderInner(p, inst.geo, o, { dark: inst.dark, hueMix, dx });
  }
  engine = { reduced, instances, io, ensureRunning };
  return engine;
}

function autoDark() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Mount a live glyph into `el`. Returns a handle:
 *   handle.setState('idle'|'working'|'waiting'|'done'|'error')
 *   handle.destroy()
 *   handle.params — the derived identity parameters
 *
 * kind 'user' glyphs are always static portraits and ignore setState.
 */
export function mountGlyph(el, seed, opts = {}) {
  const eng = getEngine();
  const kind = opts.kind || 'agent';
  const size = opts.size || 64;
  const dark = opts.dark != null ? !!opts.dark : autoDark();
  let p = deriveV1(seed);
  if (size < 28 && p.finish === 2) p = { ...p, finish: 0 };
  const geo = buildSolid(p.solidType, p.n, p.prop);
  const initial = kind === 'user' ? 'idle' : (opts.state || 'idle');
  el.classList.add('prismicon');
  el.innerHTML = '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size +
    '" role="img"><g></g><g></g></svg>';
  const svg = el.querySelector('svg');
  const gs = el.querySelectorAll('g');
  const inst = {
    svg, g: gs[0], sg: gs[1], p, geo, kind, dark, seedRaw: String(seed),
    state: !eng.reduced && (initial === 'working' || initial === 'waiting') ? initial : 'idle',
    ori: !eng.reduced && initial === 'working'
      ? (p.axisMode === 0 ? { ax: 0.18, ay: p.phase, az: p.precess ? p.phase2 : 0 }
        : p.axisMode === 1 ? { ax: p.phase, ay: 0.18, az: p.precess ? p.phase2 : 0 }
        : { ax: 0.42, ay: 0, az: p.phase })
      : { ...PORTRAITS[p.solidType] },
    flash: null, flashT: 0, shake: false, visible: true,
    publicState: initial
  };
  inst.g.innerHTML = renderInner(p, geo, inst.ori, { dark });
  applyStatus(inst, initial, false);
  if (kind === 'agent' && !eng.reduced) {
    eng.instances.push(inst);
    if (eng.io) eng.io.observe(svg);
    eng.ensureRunning();
  }
  function applyStatus(target, stateName, animate) {
    const status = RING_FOR_STATE[stateName] || null;
    target.sg.innerHTML = ringMarkup(status, animate);
    target.svg.setAttribute('aria-label', describeInstance(target.seedRaw, target.p, target.kind, stateName));
  }
  return {
    params: p,
    get state() { return inst.publicState; },
    setState(name) {
      if (kind !== 'agent' || STATES.indexOf(name) < 0) return;
      inst.publicState = name;
      if (eng.reduced) {
        inst.ori = { ...PORTRAITS[p.solidType] };
        inst.g.innerHTML = renderInner(p, geo, inst.ori, { dark });
        applyStatus(inst, name, false);
        return;
      }
      if (name === 'working' || name === 'waiting') {
        inst.state = name; inst.flash = null;
      } else {
        inst.state = 'settling'; inst.flashT = 0;
        if (name === 'done') { inst.flash = 145; inst.shake = false; }
        else if (name === 'error') { inst.flash = 4; inst.shake = true; }
        else { inst.flash = null; }
      }
      applyStatus(inst, name, true);
      eng.ensureRunning();
    },
    destroy() {
      const i = eng.instances.indexOf(inst);
      if (i >= 0) eng.instances.splice(i, 1);
      if (eng.io) eng.io.unobserve(svg);
      el.innerHTML = '';
      el.classList.remove('prismicon');
    }
  };
}
