/**
 * prismicon n-cube variant family — deterministic projected hypercubes.
 *
 * Derivation spec ncube-v1 (FROZEN — do not reorder draws):
 *   seed -> normalizeSeed -> cyrb53 -> mulberry32
 *   draw order: dimension (always drawn, even for ncube-<d> ids which then
 *               override it), finish, theta[0..NCUBE_MAX_DIMENSION-4]
 *               (plane angles for axes 3..MAX-1, always MAX-3 draws), ax, ay, az
 *   hue = PALETTE[hash % 12]; hue2 = PALETTE[(idx + 4) % 12]
 *
 * Raising NCUBE_MAX_DIMENSION changes the dimension draw and the theta count,
 * so it requires a new spec version.
 *
 * Motion traits (dir, hyperSpeed, spinAxis, spin3, phase, phase2) are NOT part of
 * the spec: prepareNcube derives them from params.hash bit ranges and the existing
 * angles without new PRNG draws, so deriveNcube output and the static portrait are
 * unchanged. The MOTION_* constants below are tunable, non-identity values.
 */

import { defineVariant } from './registry.js';
import { cyrb53, mulberry32 } from './seed.js';
import { FINISH_NAMES, PALETTE, angDiff, normalizeSeed, wrapAngle } from './polyhedron.js';

const TAU = Math.PI * 2;

export const NCUBE_SPEC_VERSION = 'ncube-v1';
export const NCUBE_MIN_DIMENSION = 3;
// Fixed by scripts/measure-ncube.mjs (features/2026/09/ncube-geometry-family/evidence/ncube-bounds.txt); frozen with ncube-v1.
export const NCUBE_MAX_DIMENSION = 6;
export const NCUBE_NAMES = Object.freeze({
  3: 'cube', 4: 'tesseract', 5: 'penteract', 6: 'hexeract',
  7: 'hepteract', 8: 'octeract', 9: 'enneract', 10: 'dekeract'
});

// ---------------------------------------------------------------- spec ncube-v1

export function deriveNcube(seed, fixedDimension = null) {
  const norm = normalizeSeed(seed);
  const hash = cyrb53(norm);
  const r = mulberry32(hash);
  const drawn = NCUBE_MIN_DIMENSION + Math.floor(r() * (NCUBE_MAX_DIMENSION - NCUBE_MIN_DIMENSION + 1));
  const finish = Math.floor(r() * 3);
  const theta = Object.freeze(Array.from({ length: NCUBE_MAX_DIMENSION - 3 }, () => r() * TAU));
  const ax = r() * TAU;
  const ay = r() * TAU;
  const az = r() * TAU;
  const hueIdx = hash % PALETTE.length;
  return Object.freeze({
    spec: NCUBE_SPEC_VERSION, seed: norm, hash,
    dimension: fixedDimension ?? drawn, finish, theta, ax, ay, az,
    hue: PALETTE[hueIdx], hue2: PALETTE[(hueIdx + 4) % PALETTE.length]
  });
}

/** Human-readable anatomy, e.g. "4-cube (tesseract), wireframe". */
export function describeNcube(p) {
  return `${p.dimension}-cube (${NCUBE_NAMES[p.dimension]}), ${FINISH_NAMES[p.finish]}`;
}

// ---------------------------------------------------------------- geometry

/**
 * Build the d-cube: 2^d vertices (index bit i -> coordinate i, 0 -> -1, 1 -> +1),
 * d*2^(d-1) edges joining vertices that differ in one bit, and C(d,2)*2^(d-2)
 * square 2-faces, one per free-axis pair and fixed value of the other axes.
 */
export function buildNcube(d) {
  const n = 1 << d;
  const V = Array.from({ length: n }, (_, i) =>
    Object.freeze(Array.from({ length: d }, (_, k) => ((i >> k) & 1 ? 1 : -1))));
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < d; k++) {
      const j = i ^ (1 << k);
      if (i < j) edges.push(Object.freeze([i, j]));
    }
  }
  const faces = [];
  for (let a = 0; a < d; a++) {
    for (let b = a + 1; b < d; b++) {
      const ma = 1 << a, mb = 1 << b;
      for (let i = 0; i < n; i++) {
        if (i & ma || i & mb) continue;
        faces.push(Object.freeze({ v: Object.freeze([i, i | ma, i | ma | mb, i | mb]), axes: Object.freeze([a, b]) }));
      }
    }
  }
  return Object.freeze({ dimension: d, V: Object.freeze(V), edges: Object.freeze(edges), faces: Object.freeze(faces) });
}

export function ncubeGeometry(params) {
  return buildNcube(params.dimension);
}

// ---------------------------------------------------------------- math (mirrors polyhedron.js)

const F = 150;            // 3D -> 2D perspective focal length, as in polyhedron
const FIT_RADIUS = 26;    // projected 3D silhouette radius around (50, 50)
const VIEW_DISTANCE = 3;  // d -> 3 perspective eye distance in normalized units (outer:inner cell = 2:1)
const FACE_OPACITY = '0.65';

function rot3(v, ax, ay, az) {
  const x = v[0], y = v[1], z = v[2];
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

function shadeFor(dark) {
  return dark
    ? { base: 40, range: 26, edge: 78, wire: 62 }
    : { base: 30, range: 28, edge: 24, wire: 45 };
}

/**
 * Project the d-cube vertices into 3D. For each higher axis k (from d-1 down to
 * 3): rotate the plane (k mod 3, k) by theta[k - 3], then apply a perspective
 * division from axis k, normalized by the largest |x_k| so every level nests
 * the far cell inside the near one at the same ratio. The result is scaled so
 * the farthest point sits at FIT_RADIUS.
 */
function projectTo3(geo, theta) {
  const pts = geo.V.map((v) => v.slice());
  for (let k = geo.dimension - 1; k >= 3; k--) {
    const i = k % 3;
    const c = Math.cos(theta[k - 3]), s = Math.sin(theta[k - 3]);
    let reach = 0;
    for (const pt of pts) {
      const a = pt[i], b = pt[k];
      pt[i] = a * c - b * s;
      pt[k] = a * s + b * c;
      reach = Math.max(reach, Math.abs(pt[k]));
    }
    reach = reach || 1;
    for (const pt of pts) {
      const w = VIEW_DISTANCE / (VIEW_DISTANCE - pt[k] / reach);
      for (let j = 0; j < k; j++) pt[j] *= w;
    }
  }
  let radius = 0;
  for (const pt of pts) radius = Math.max(radius, Math.hypot(pt[0], pt[1], pt[2]));
  const scale = FIT_RADIUS / (radius || 1);
  return pts.map((pt) => [pt[0] * scale, pt[1] * scale, pt[2] * scale]);
}

const STROKE_BY_DIMENSION = { 3: 3.5, 4: 3, 5: 2.5, 6: 2, 7: 1.6, 8: 1.3 };

function strokeWidthFor(dimension) {
  return STROKE_BY_DIMENSION[dimension] ?? 1;
}

// ---------------------------------------------------------------- motion traits (tunable, non-identity)

const MOTION_HYPER_BASE = 0.55;    // rad/s floor of the highest-plane rotation at d = 4
const MOTION_HYPER_SPREAD = 0.35;  // per-seed spread added to the floor
const MOTION_HYPER_DAMP = 0.25;    // slow-down per dimension above 4 so 5-/6-cubes stay legible
const MOTION_SPIN3_HYPER = 0.22;   // rad/s slow 3D drift accompanying hyper-rotation (d >= 4)
const MOTION_SPIN3_BASE = 0.45;    // rad/s floor of a cube's 3D spin (its only working motion)
const MOTION_SPIN3_SPREAD = 0.4;   // per-seed spread of the cube spin
const MOTION_CASCADE = 0.4;        // speed ratio between a plane and the one above it in working
const SPIN_AXES = Object.freeze(['ax', 'ay', 'az']);

function motionTraits(params) {
  const { hash, dimension } = params;
  const dir = hash % 2 === 0 ? 1 : -1;
  const hyperSpeed = dimension >= 4
    ? (MOTION_HYPER_BASE + (Math.floor(hash / 2) % 256) / 255 * MOTION_HYPER_SPREAD) / (1 + MOTION_HYPER_DAMP * (dimension - 4))
    : 0;
  const spinAxis = SPIN_AXES[Math.floor(hash / 512) % 3];
  const spin3 = dimension >= 4
    ? dir * MOTION_SPIN3_HYPER
    : dir * (MOTION_SPIN3_BASE + (Math.floor(hash / 1536) % 256) / 255 * MOTION_SPIN3_SPREAD);
  return { dir, hyperSpeed, spinAxis, spin3, phase: params.ax, phase2: params.ay };
}

// ---------------------------------------------------------------- variant hooks

export function prepareNcube(params, { size }) {
  const finish = size < 28 && params.finish === 2 ? 0 : params.finish;
  return { ...params, finish, strokeWidth: strokeWidthFor(params.dimension), ...motionTraits(params) };
}

/**
 * Rest pose for every state: the seed's 3D angles plus the plane angles. Motion
 * always starts from rest so the first mounted frame equals the static portrait.
 */
export function poseNcube(params) {
  return Object.freeze({ ax: params.ax, ay: params.ay, az: params.az, theta: params.theta });
}

export function animateNcube(pose, ctx) {
  const { params: p, state, dt, rest } = ctx;
  if (state === 'idle' || state === 'done' || state === 'error') return pose;
  const top = p.dimension - 4;
  const ease = (cur, target, k) => cur + angDiff(target, cur) * k;
  if (state === 'working') {
    const k = Math.min(1, dt * 3);
    const theta = top < 0
      ? pose.theta
      : Object.freeze(pose.theta.map((th, i) =>
        i > top ? th : wrapAngle(th + p.dir * p.hyperSpeed * MOTION_CASCADE ** (top - i) * dt)));
    const next = { ax: ease(pose.ax, rest.ax, k), ay: ease(pose.ay, rest.ay, k), az: ease(pose.az, rest.az, k) };
    next[p.spinAxis] = wrapAngle(pose[p.spinAxis] + p.spin3 * dt);
    return Object.freeze({ ...next, theta });
  }
  return state === 'settling' ? rest : pose;
}

export function paintNcube(p, geo, o, effects) {
  const shade = shadeFor(!!effects.dark);
  const off = effects.dx || 0;
  const lighten = effects.lighten || 0;
  const range = effects.sleeping ? shade.range * 0.55 : shade.range;
  const hueMix = effects.flash ? lerpHue(p.hue, effects.flash.hue ?? p.hue, effects.flash.strength) : null;
  const strokeWidth = p.strokeWidth ?? strokeWidthFor(p.dimension);
  const pts3 = projectTo3(geo, o.theta).map((v) => rot3(v, o.ax, o.ay, o.az));
  const proj = pts3.map((v) => {
    const s = F / (F - v[2]);
    return (50 + off + v[0] * s).toFixed(1) + ' ' + (50 + v[1] * s).toFixed(1);
  });
  const ink = (h, L) => 'hsl(' + Math.round(h) + ' 52% ' + Math.round(Math.min(92, L + lighten)) + '%)';
  if (p.finish === 2) {
    const d = geo.edges.map(([a, b]) => 'M' + proj[a] + ' L' + proj[b]).join(' ');
    return '<path d="' + d + '" fill="none" stroke="' + ink(hueMix ?? p.hue, shade.wire) +
      '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  const faces = geo.faces.map((f) => {
    const [a, b, , d] = f.v;
    const z = (pts3[a][2] + pts3[b][2] + pts3[f.v[2]][2] + pts3[d][2]) / 4;
    const u = [pts3[b][0] - pts3[a][0], pts3[b][1] - pts3[a][1], pts3[b][2] - pts3[a][2]];
    const v = [pts3[d][0] - pts3[a][0], pts3[d][1] - pts3[a][1], pts3[d][2] - pts3[a][2]];
    const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
    const m = Math.hypot(nx, ny, nz) || 1;
    return { v: f.v, axes: f.axes, z, nz: Math.abs(nz / m) };
  });
  faces.sort((a, b) => a.z - b.z);
  const edgeWidth = (strokeWidth / 3.5).toFixed(2).replace(/\.?0+$/, '');
  return '<g stroke-width="' + edgeWidth + '" stroke-linejoin="round" fill-opacity="' + FACE_OPACITY + '">' +
    faces.map((f) => {
      const h = hueMix ?? (p.finish === 1 && (f.axes[0] + f.axes[1]) % 2 === 1 ? p.hue2 : p.hue);
      const L = shade.base + range * Math.max(0.12, f.nz);
      return '<path d="M' + f.v.map((i) => proj[i]).join(' L') + ' Z" fill="' + ink(h, L) + '" stroke="' + ink(h, shade.edge) + '"/>';
    }).join('') + '</g>';
}

export function flashNcube(params, state) {
  if (state === 'receiving') return { hue: params.hue, lighten: 26 };
  if (state === 'done') return { hue: 145 };
  if (state === 'error') return { hue: 4, shake: true };
  return null;
}

// ---------------------------------------------------------------- descriptors

export function createNcubeVariant(dimension = null) {
  if (dimension !== null && !(Number.isInteger(dimension) && dimension >= NCUBE_MIN_DIMENSION && dimension <= NCUBE_MAX_DIMENSION)) {
    throw new RangeError(`n-cube dimension must be an integer in [${NCUBE_MIN_DIMENSION}, ${NCUBE_MAX_DIMENSION}], got ${dimension}`);
  }
  return defineVariant({
    id: dimension === null ? 'ncube' : `ncube-${dimension}`,
    label: dimension === null ? 'N-cube' : `${dimension}-cube (${NCUBE_NAMES[dimension]})`,
    spec: NCUBE_SPEC_VERSION,
    derive: (seed) => deriveNcube(seed, dimension),
    describe: describeNcube,
    prepare: prepareNcube,
    geometry: ncubeGeometry,
    pose: poseNcube,
    animate: animateNcube,
    paint: paintNcube,
    flash: flashNcube
  });
}

export const ncube = createNcubeVariant(null);

export const ncubeVariants = Object.freeze([
  ncube,
  ...Array.from({ length: NCUBE_MAX_DIMENSION - NCUBE_MIN_DIMENSION + 1 }, (_, i) => createNcubeVariant(NCUBE_MIN_DIMENSION + i))
]);
