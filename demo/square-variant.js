/**
 * Example custom variant: a single spinning square.
 *
 * Written the way README `## Custom variants` describes: eight pure hooks, an
 * id/label/spec header, and `defineVariant` for the shape check. It shares no
 * code with the built-in polyhedron implementation, so it doubles as the test
 * suite's proof that the renderer is variant-agnostic (`test/fixtures/square-variant.js`
 * re-exports this module).
 */

import { defineVariant } from '../src/index.js';

/** Bump this whenever `derive` changes what a seed maps to. */
export const SPEC_VERSION = 'test-square-1';

// derive(seed): deterministic and SSR-safe — no Math.random, Date, or browser globals.
export function derive(seed) {
  const norm = String(seed).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) hash = ((hash << 5) - hash) + norm.charCodeAt(i);
  return { spec: SPEC_VERSION, seed: norm, hue: 60 + (Math.abs(hash) % 300) };
}

// describe(params): accessible text; must be non-empty.
export function describe(params) {
  return `square ${params.seed}`;
}

// prepare(params, { size }): size-dependent tweaks, once per mount.
export function prepare(params, { size }) {
  return { ...params, stroke: size < 32 ? 2 : 4 };
}

// geometry(params): computed once and reused for every frame.
export function geometry(params) {
  return { side: 40 };
}

// pose(params, state): rest pose per state; the idle pose is the reduced-motion appearance.
export function pose(params, state) {
  if (state === 'working') return { angle: (params.seed.length * 17) % 360 };
  return { angle: 0 };
}

// animate(pose, ctx): return a new pose each frame; return ctx.rest while settling to stop.
export function animate(pose, ctx) {
  const { state, dt, rest } = ctx;
  if (state === 'working') {
    return { angle: (pose.angle + 90 * dt) % 360 };
  }
  if (state === 'settling') {
    const speed = 4;
    const diff = ((rest.angle - pose.angle + 540) % 360) - 180;
    if (Math.abs(diff) < 0.5) return rest;
    return { angle: (pose.angle + diff * Math.min(1, dt * speed) + 360) % 360 };
  }
  return pose;
}

// paint(params, geometry, pose, effects): inner SVG markup for a 100x100 viewBox.
export function paint(params, geometry, pose) {
  const half = geometry.side / 2;
  return `<rect x="${50 - half}" y="${50 - half}" width="${geometry.side}" height="${geometry.side}" fill="hsl(${params.hue} 70% 50%)" stroke="black" stroke-width="${params.stroke}" transform="rotate(${pose.angle.toFixed(1)} 50 50)"/>`;
}

// flash(params, state): transient emphasis on a state change, or null.
export function flash(params, state) {
  if (state === 'receiving') return { hue: params.hue, lighten: 20 };
  return null;
}

export const square = defineVariant({
  id: 'square',
  label: 'Square',
  spec: SPEC_VERSION,
  derive,
  describe,
  prepare,
  geometry,
  pose,
  animate,
  paint,
  flash
});
