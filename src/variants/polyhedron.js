/**
 * prismicon polyhedron variant — the frozen v1 3D identicon engine.
 *
 * This module owns every polyhedron-specific concern: derivation spec v1,
 * geometry construction, per-state pose/motion, and painting. It imports only
 * the registry validator, so the shared pipeline can import it without
 * creating a cycle.
 *
 * Derivation spec v1 (FROZEN — do not reorder draws):
 *   seed -> normalize (trim + lowercase) -> cyrb53 hash -> mulberry32 PRNG
 *   draw order: n, solidType, finish, prop, axisMode, speedMag, speedSign,
 *               phase, precess, zSpeedMag, zSpeedSign, phase2
 *   hue = PALETTE[hash % 12]; hue2 = PALETTE[(idx + 4) % 12]
 */

import { defineVariant } from './registry.js';
import { cyrb53, mulberry32 } from './seed.js';

const TAU = Math.PI * 2;
const F = 150; // perspective focal length

export const SPEC_VERSION = 'v1';
export const SIDE_NAMES = { 3: 'triangle', 4: 'square', 5: 'pentagon', 6: 'hexagon' };
export const SOLID_NAMES = ['prism', 'pyramid', 'bipyramid', 'antiprism'];
export const FINISH_NAMES = ['shaded', 'two-tone', 'wireframe'];
export const PALETTE = [8, 25, 45, 95, 145, 170, 200, 220, 250, 275, 300, 330];

const PORTRAITS = [
  { ax: 0.30, ay: 0.42, az: 0 }, // prism
  { ax: 0.20, ay: 1.05, az: 0 }, // pyramid — profile, apex visible
  { ax: 0.15, ay: 1.00, az: 0 }, // bipyramid — full diamond silhouette
  { ax: 0.50, ay: 0.35, az: 0 }  // antiprism — reveals the twist band
];

// ---------------------------------------------------------------- seed

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
  const lighten = opts.lighten || 0;
  const sleeping = !!opts.sleeping;
  const range = sleeping ? shade.range * 0.55 : shade.range;
  const pts3 = geo.V.map((v) => rot3(v, o.ax, o.ay, o.az));
  const proj = pts3.map((v) => {
    const s = F / (F - v[2]);
    return [(50 + off + v[0] * s).toFixed(1), (50 + v[1] * s).toFixed(1)];
  });
  const ink = (h, L) => 'hsl(' + Math.round(h) + ' 52% ' + Math.round(Math.min(92, L + lighten)) + '%)';
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
    const L = shade.base + range * Math.max(0.12, f.nz);
    const d = 'M' + f.idx.map((i) => proj[i][0] + ' ' + proj[i][1]).join(' L') + ' Z';
    return '<path d="' + d + '" fill="' + ink(h, L) + '" stroke="' + ink(h, shade.edge) +
      '" stroke-width="1" stroke-linejoin="round"/>';
  }).join('');
}

// ---------------------------------------------------------------- variant hooks

export function prepareParams(params, { size }) {
  if (size < 28 && params.finish === 2) return { ...params, finish: 0 };
  return params;
}

export function buildGeometry(params) {
  return buildSolid(params.solidType, params.n, params.prop);
}

export function poseForState(params, state) {
  if (state === 'working') {
    return params.axisMode === 0
      ? { ax: 0.18, ay: params.phase, az: params.precess ? params.phase2 : 0 }
      : params.axisMode === 1
        ? { ax: params.phase, ay: 0.18, az: params.precess ? params.phase2 : 0 }
        : { ax: 0.42, ay: 0, az: params.phase };
  }
  return PORTRAITS[params.solidType];
}

export function animatePose(pose, ctx) {
  const { params: p, state, dt, t, transientT, rest } = ctx;
  if (state === 'idle' || state === 'done' || state === 'error') return pose;
  if (state === 'working') {
    const k = Math.min(1, dt * 3);
    const next = { ...pose };
    if (p.axisMode === 0) {
      next.ay = wrapAngle(pose.ay + p.speed * dt); next.ax += (0.18 - pose.ax) * k;
      if (p.precess) next.az = wrapAngle(pose.az + p.zSpeed * dt); else next.az += angDiff(0, pose.az) * k;
    } else if (p.axisMode === 1) {
      next.ax = wrapAngle(pose.ax + p.speed * dt); next.ay += (0.18 - pose.ay) * k;
      if (p.precess) next.az = wrapAngle(pose.az + p.zSpeed * dt); else next.az += angDiff(0, pose.az) * k;
    } else {
      next.az = wrapAngle(pose.az + p.speed * dt); next.ax += (0.42 - pose.ax) * k; next.ay += angDiff(0, pose.ay) * k;
    }
    return next;
  }
  if (state === 'waiting') {
    const port = PORTRAITS[p.solidType];
    const tx = port.ax + Math.sin(t * 0.8 + p.phase) * 0.05;
    const ty = port.ay + Math.sin(t * 0.55 + p.phase2) * 0.10;
    const k = Math.min(1, dt * 3.5);
    return {
      ax: pose.ax + angDiff(tx, pose.ax) * k,
      ay: pose.ay + angDiff(ty, pose.ay) * k,
      az: pose.az + angDiff(port.az, pose.az) * k
    };
  }
  if (state === 'settling') {
    const k = Math.min(1, dt * 4.5);
    const da = angDiff(rest.ax, pose.ax), db = angDiff(rest.ay, pose.ay), dc = angDiff(rest.az, pose.az);
    if (Math.abs(da) < 0.015 && Math.abs(db) < 0.015 && Math.abs(dc) < 0.015) return rest;
    return {
      ax: pose.ax + da * k,
      ay: pose.ay + db * k,
      az: pose.az + dc * k
    };
  }
  if (state === 'thinking') {
    const port = PORTRAITS[p.solidType];
    const wobbleA = Math.sin(t * 0.6 + p.phase) * 0.10;
    const wobbleB = Math.sin(t * 0.45 + p.phase2) * 0.08;
    const nod = Math.max(0, Math.sin(t * 0.35 + p.phase)) * 0.12;
    const k = Math.min(1, dt * 2.2);
    return {
      ax: pose.ax + angDiff(port.ax + wobbleA, pose.ax) * k,
      ay: pose.ay + angDiff(port.ay + wobbleB + nod, pose.ay) * k,
      az: pose.az + angDiff(port.az, pose.az) * k
    };
  }
  if (state === 'sleeping') {
    const port = PORTRAITS[p.solidType];
    const bob = Math.sin(t * 0.25 + p.phase) * 0.03;
    const k = Math.min(1, dt * 1.2);
    return {
      ax: pose.ax + angDiff(port.ax + bob, pose.ax) * k,
      ay: pose.ay + angDiff(port.ay, pose.ay) * k,
      az: pose.az + angDiff(port.az, pose.az) * k
    };
  }
  if (state === 'sending' || state === 'receiving') {
    const dir = state === 'sending' ? 1 : -1;
    const spin = p.speed * 3.2 * Math.exp(-transientT * 7);
    return {
      ax: pose.ax + angDiff(PORTRAITS[p.solidType].ax, pose.ax) * Math.min(1, dt * 4),
      ay: wrapAngle(pose.ay + dir * spin * dt),
      az: pose.az
    };
  }
  return pose;
}

export function paintFrame(params, geometry, pose, effects) {
  const hueMix = effects.flash ? lerpHue(params.hue, effects.flash.hue ?? params.hue, effects.flash.strength) : null;
  return renderInner(params, geometry, pose, {
    dark: effects.dark,
    dx: effects.dx,
    hueMix,
    lighten: effects.lighten,
    sleeping: effects.sleeping
  });
}

export function flashForState(params, state) {
  if (state === 'receiving') return { hue: params.hue, lighten: 26 };
  if (state === 'done') return { hue: 145 };
  if (state === 'error') return { hue: 4, shake: true };
  return null;
}

export const polyhedron = defineVariant({
  id: 'polyhedron',
  label: 'Polyhedron',
  spec: SPEC_VERSION,
  derive: deriveV1,
  describe: describeParams,
  prepare: prepareParams,
  geometry: buildGeometry,
  pose: poseForState,
  animate: animatePose,
  paint: paintFrame,
  flash: flashForState
});

