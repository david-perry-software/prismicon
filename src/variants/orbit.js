/**
 * prismicon orbit variant — flat concentric orbital rings, no projection.
 *
 * A 2D-forward contrast to the shaded polyhedra and wireframe n-cubes:
 * `ringCount` concentric rings carry seed-placed nodes around a core mark,
 * computed directly in the 100x100 viewBox (no 3D math, no focal length).
 *
 * Derivation spec orbit-v1 (FROZEN — do not reorder draws; every draw is made
 * regardless of the derived ring/node counts so the order never depends on
 * earlier values; 22 draws total):
 *   seed -> normalizeSeed -> cyrb53 -> mulberry32
 *   draw order: ringCount,
 *               nodeCounts[0..ORBIT_MAX_RINGS-1]      (4 draws),
 *               nodeAngles[0..ORBIT_MAX_RINGS*ORBIT_MAX_NODES-1]  (16 draws),
 *               coreMark
 *   hue = PALETTE[hash % 12]; hue2 = PALETTE[(idx + 4) % 12]
 *
 * Raising ORBIT_MAX_RINGS or ORBIT_MAX_NODES changes the draw count, so it
 * requires a new spec version.
 *
 * Motion traits (dir, ringSpeeds, phase) are NOT part of the spec: prepareOrbit
 * derives them from disjoint bit ranges of params.hash with no new PRNG draws,
 * so deriveOrbit output and the static portrait are unchanged. The ORBIT_MOTION_*
 * constants below are tunable, non-identity values.
 */

import { defineVariant } from './registry.js';
import { cyrb53, mulberry32 } from './seed.js';
import { PALETTE, angDiff, normalizeSeed, wrapAngle } from './polyhedron.js';

const TAU = Math.PI * 2;

export const ORBIT_SPEC_VERSION = 'orbit-v1';
export const ORBIT_MAX_RINGS = 4;
export const ORBIT_MAX_NODES = 4;

const FIT_RADIUS = 26;      // outermost ring radius around (50, 50), the shared silhouette bound
const NODE_RADIUS = 2.4;    // node dot radius in viewBox units
const CORE_RADIUS = 3.2;    // dot core mark radius in viewBox units (scaled by coreScale)
const CORE_ARM = 5;         // plus core mark half-arm in viewBox units (scaled by coreScale)
const CORE_DIAGONAL = 4.5;  // diamond core mark half-diagonal in viewBox units (scaled by coreScale)

export const ORBIT_CORE_MARKS = Object.freeze(['dot', 'plus', 'diamond']);

// ---------------------------------------------------------------- spec orbit-v1

export function deriveOrbit(seed) {
  const norm = normalizeSeed(seed);
  const hash = cyrb53(norm);
  const r = mulberry32(hash);
  const ringCount = 2 + Math.floor(r() * (ORBIT_MAX_RINGS - 1));
  const nodeCounts = Object.freeze(Array.from({ length: ORBIT_MAX_RINGS }, () => 1 + Math.floor(r() * ORBIT_MAX_NODES)));
  const nodeAngles = Object.freeze(Array.from({ length: ORBIT_MAX_RINGS * ORBIT_MAX_NODES }, () => r() * TAU));
  const coreMark = Math.floor(r() * ORBIT_CORE_MARKS.length);
  const hueIdx = hash % PALETTE.length;
  return Object.freeze({
    spec: ORBIT_SPEC_VERSION, seed: norm, hash,
    ringCount, nodeCounts, nodeAngles, coreMark,
    hue: PALETTE[hueIdx], hue2: PALETTE[(hueIdx + 4) % PALETTE.length]
  });
}

/** Human-readable anatomy, e.g. "3-ring orbit, 9 nodes, diamond core". */
export function describeOrbit(p) {
  const nodes = p.nodeCounts.slice(0, p.ringCount).reduce((sum, n) => sum + n, 0);
  return `${p.ringCount}-ring orbit, ${nodes} nodes, ${ORBIT_CORE_MARKS[p.coreMark]} core`;
}

// ---------------------------------------------------------------- geometry

/**
 * Ring radii spread evenly up to FIT_RADIUS and per-ring node rest angles sliced
 * from the frozen spec draws. Frozen; computed once per instance.
 */
export function buildOrbit(params) {
  const radii = Object.freeze(Array.from({ length: params.ringCount },
    (_, r) => (FIT_RADIUS * (r + 1)) / params.ringCount));
  const slots = Object.freeze(Array.from({ length: params.ringCount }, (_, r) =>
    Object.freeze(params.nodeAngles.slice(r * ORBIT_MAX_NODES, r * ORBIT_MAX_NODES + params.nodeCounts[r]))));
  return Object.freeze({ radii, slots });
}

// ---------------------------------------------------------------- motion traits (tunable, non-identity)

const ORBIT_MOTION_SPEED_BASE = 0.5;   // rad/s floor of a ring's working speed
const ORBIT_MOTION_SPEED_SPREAD = 0.5; // per-seed spread added to the floor

/**
 * Traits from disjoint bit ranges of params.hash (bit 0: dir; bytes at bits
 * 1+8r..8+8r: per-ring speed magnitude; bits 33-40: phase) — never new PRNG
 * draws, so the orbit-v1 identities stay frozen.
 */
function motionTraits(params) {
  const { hash } = params;
  const dir = hash % 2 === 0 ? 1 : -1;
  const ringSpeeds = Array.from({ length: params.ringCount }, (_, r) => {
    const byte = Math.floor(hash / 2 ** (1 + 8 * r)) % 256;
    return dir * (r % 2 === 0 ? 1 : -1) * (ORBIT_MOTION_SPEED_BASE + (byte / 255) * ORBIT_MOTION_SPEED_SPREAD);
  });
  const phase = ((Math.floor(hash / 2 ** 33) % 256) / 255) * TAU;
  return { dir, ringSpeeds, phase };
}

// ---------------------------------------------------------------- variant hooks

export function prepareOrbit(params, { size }) {
  return { ...params, strokeWidth: 1.6, ...motionTraits(params) };
}

/**
 * Rest pose for every state: all ring offsets at zero and a neutral core scale.
 * Motion always starts from rest so the first mounted frame equals the static
 * portrait and reduced-motion output is the static markup.
 */
export function poseOrbit(params, state) {
  return Object.freeze({
    offsets: Object.freeze(Array.from({ length: params.ringCount }, () => 0)),
    coreScale: 1
  });
}

export function animateOrbit(pose, ctx) {
  if (ctx.state === 'settling') return ctx.rest;
  return pose;
}

// ---------------------------------------------------------------- painting

function shadeFor(dark) {
  return dark
    ? { base: 40, range: 26 }
    : { base: 30, range: 28 };
}

function lerpHue(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

export function paintOrbit(p, geo, o, effects) {
  const shade = shadeFor(!!effects.dark);
  const off = effects.dx || 0;
  const lighten = effects.lighten || 0;
  const range = effects.sleeping ? shade.range * 0.55 : shade.range;
  const hueMix = effects.flash ? lerpHue(p.hue, effects.flash.hue ?? p.hue, effects.flash.strength) : null;
  const strokeWidth = p.strokeWidth ?? 1.6;
  const ink = (h, L) => 'hsl(' + Math.round(h) + ' 52% ' + Math.round(Math.min(92, L + lighten)) + '%)';
  const cx = (50 + off).toFixed(1);
  const point = (radius, angle) =>
    (50 + off + Math.cos(angle) * radius).toFixed(1) + ' ' + (50 + Math.sin(angle) * radius).toFixed(1);
  const parts = [];
  for (let r = 0; r < geo.radii.length; r++) {
    parts.push('<circle cx="' + cx + '" cy="50" r="' + geo.radii[r].toFixed(1) + '" fill="none" stroke="' +
      ink(hueMix ?? p.hue, shade.base + range * 0.55) + '" stroke-width="' + strokeWidth + '"/>');
  }
  for (let r = 0; r < geo.radii.length; r++) {
    const nodeHue = hueMix ?? (r % 2 === 0 ? p.hue : p.hue2);
    for (let n = 0; n < geo.slots[r].length; n++) {
      const [x, y] = point(geo.radii[r], geo.slots[r][n] + o.offsets[r]).split(' ');
      parts.push('<circle cx="' + x + '" cy="' + y + '" r="' + NODE_RADIUS + '" fill="' +
        ink(nodeHue, shade.base + range * 0.9) + '"/>');
    }
  }
  const coreHue = hueMix ?? p.hue;
  const coreInk = ink(coreHue, shade.base + range * 0.7);
  const coreScale = o.coreScale;
  if (p.coreMark === 1) {
    parts.push('<path d="M' + (50 + off - CORE_ARM * coreScale).toFixed(1) + ' 50 L' + (50 + off + CORE_ARM * coreScale).toFixed(1) +
      ' 50 M' + cx + ' ' + (50 - CORE_ARM * coreScale).toFixed(1) + ' L' + cx + ' ' + (50 + CORE_ARM * coreScale).toFixed(1) +
      '" fill="none" stroke="' + coreInk + '" stroke-width="' + strokeWidth + '" stroke-linecap="round"/>');
  } else if (p.coreMark === 2) {
    const a = CORE_DIAGONAL * coreScale;
    parts.push('<path d="M' + cx + ' ' + (50 - a).toFixed(1) + ' L' + (50 + off + a).toFixed(1) + ' 50 L' + cx + ' ' +
      (50 + a).toFixed(1) + ' L' + (50 + off - a).toFixed(1) + ' 50 Z" fill="' + coreInk + '"/>');
  } else {
    parts.push('<circle cx="' + cx + '" cy="50" r="' + (CORE_RADIUS * coreScale).toFixed(1) + '" fill="' + coreInk + '"/>');
  }
  return parts.join('');
}

export function flashOrbit(params, state) {
  if (state === 'receiving') return { hue: params.hue, lighten: 26 };
  if (state === 'done') return { hue: 145 };
  if (state === 'error') return { hue: 4, shake: true };
  return null;
}

// ---------------------------------------------------------------- descriptor

export const orbit = defineVariant({
  id: 'orbit',
  label: 'Orbit',
  spec: ORBIT_SPEC_VERSION,
  derive: deriveOrbit,
  describe: describeOrbit,
  prepare: prepareOrbit,
  geometry: buildOrbit,
  pose: poseOrbit,
  animate: animateOrbit,
  paint: paintOrbit,
  flash: flashOrbit
});
