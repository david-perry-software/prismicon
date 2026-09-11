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
 */

import { defineVariant } from './registry.js';
import { cyrb53, mulberry32 } from './seed.js';
import { FINISH_NAMES, PALETTE, normalizeSeed } from './polyhedron.js';

const TAU = Math.PI * 2;

export const NCUBE_SPEC_VERSION = 'ncube-v1';
export const NCUBE_MIN_DIMENSION = 3;
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

// ---------------------------------------------------------------- variant hooks (paint side lands in step 2.3)

function notImplemented() {
  throw new Error('ncube paint-side hooks are not implemented yet');
}

export const prepareNcube = notImplemented;
export const poseNcube = notImplemented;
export const animateNcube = notImplemented;
export const paintNcube = notImplemented;
export const flashNcube = notImplemented;

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
