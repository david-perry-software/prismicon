/**
 * Test-only square variant fixture.
 *
 * A deliberately minimal variant used to prove that the renderer dispatch is
 * variant-agnostic: it renders a single `<rect>` that spins while `working`
 * and settles back to the portrait pose, with no shared code from the
 * polyhedron implementation.
 */

export const SPEC_VERSION = 'test-square-1';

export function derive(seed) {
  const norm = String(seed).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) hash = ((hash << 5) - hash) + norm.charCodeAt(i);
  return { spec: SPEC_VERSION, seed: norm, hue: 60 + (Math.abs(hash) % 300) };
}

export function describe(params) {
  return `square ${params.seed}`;
}

export function prepare(params, { size }) {
  return { ...params, stroke: size < 32 ? 2 : 4 };
}

export function geometry(params) {
  return { side: 40 };
}

export function pose(params, state) {
  if (state === 'working') return { angle: (params.seed.length * 17) % 360 };
  return { angle: 0 };
}

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

export function paint(params, geometry, pose) {
  const half = geometry.side / 2;
  return `<rect x="${50 - half}" y="${50 - half}" width="${geometry.side}" height="${geometry.side}" fill="hsl(${params.hue} 70% 50%)" stroke="black" stroke-width="${params.stroke}" transform="rotate(${pose.angle.toFixed(1)} 50 50)"/>`;
}

export const square = {
  id: 'square',
  label: 'Square',
  spec: SPEC_VERSION,
  derive,
  describe,
  prepare,
  geometry,
  pose,
  animate,
  paint
};
