/**
 * prismicon Wright scaffold variant — contract-valid placeholder for the future
 * Frank Lloyd Wright family. This is intentionally a spec + hook scaffold only.
 */

import { defineVariant } from './registry.js';
import { cyrb53 } from './seed.js';
import { PALETTE, normalizeSeed } from './polyhedron.js';

export const WRIGHT_SPEC_VERSION = 'wright-scaffold-v1';
export const WRIGHT_FAMILIES = Object.freeze(['prairie', 'art-glass', 'textile-block', 'usonian']);
export const WRIGHT_DRAW_ORDER = Object.freeze([
  'dominantFamily',
  'hybrid',
  'secondaryFamily',
  'massWidth',
  'massHeight',
  'massOffset',
  'planeCount',
  'planeSpread',
  'gridColumns',
  'gridRows',
  'decoration',
  'accent'
]);
export const WRIGHT_HYBRID_COMPATIBILITY = Object.freeze({
  prairie: Object.freeze(['art-glass', 'usonian']),
  'art-glass': Object.freeze(['prairie', 'textile-block']),
  'textile-block': Object.freeze(['art-glass', 'usonian']),
  usonian: Object.freeze(['prairie', 'textile-block'])
});
const TAU = Math.PI * 2;

function hueMix(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

export function deriveWright(seed) {
  const norm = normalizeSeed(seed);
  const hash = cyrb53(norm);
  const lineCount = 3 + (hash % 3);
  const inset = 10 + (Math.floor(hash / 2 ** 8) % 12);
  const horizon = 42 + (Math.floor(hash / 2 ** 16) % 17) - 8;
  const cantilever = 12 + (Math.floor(hash / 2 ** 24) % 15);
  const emphasis = hash % 2 === 0 ? 'horizontal' : 'vertical';
  const phase = ((Math.floor(hash / 2 ** 32) % 256) / 255) * TAU;
  const hueIdx = hash % PALETTE.length;
  return Object.freeze({
    spec: WRIGHT_SPEC_VERSION,
    seed: norm,
    hash,
    lineCount,
    inset,
    horizon,
    cantilever,
    emphasis,
    phase,
    hue: PALETTE[hueIdx],
    hue2: PALETTE[(hueIdx + 5) % PALETTE.length]
  });
}

export function describeWright(params) {
  return `${params.lineCount}-band Wright scaffold, ${params.emphasis} emphasis`;
}

export function prepareWright(params, { size }) {
  return {
    ...params,
    strokeWidth: size < 28 ? 3 : 2.2,
    lightStroke: size < 28 ? 1.8 : 1.3
  };
}

export function buildWright(params) {
  const frame = Object.freeze({ left: params.inset, right: 100 - params.inset, top: 18, bottom: 82 });
  const bands = Object.freeze(Array.from({ length: params.lineCount }, (_, i) => {
    const y = frame.top + ((i + 1) * (frame.bottom - frame.top)) / (params.lineCount + 1);
    return Object.freeze({
      y,
      x1: frame.left,
      x2: frame.right - (i % 2 === 0 ? params.cantilever : 0)
    });
  }));
  return Object.freeze({ frame, bands });
}

export function poseWright(params, state) {
  if (state === 'working') return Object.freeze({ lift: 0.9, shear: 1.2, pulse: 1 });
  return Object.freeze({ lift: 0, shear: 0, pulse: 0 });
}

export function animateWright(pose, ctx) {
  const { state, dt, t, params, rest, transientT } = ctx;
  if (state === 'idle' || state === 'done' || state === 'error') return pose;
  if (state === 'working') {
    return Object.freeze({
      lift: Math.sin(t * 1.1 + params.phase) * 1.4,
      shear: Math.cos(t * 0.9 + params.phase) * 1.8,
      pulse: 0.5 + (Math.sin(t * 1.6 + params.phase) + 1) * 0.25
    });
  }
  if (state === 'waiting' || state === 'thinking') {
    const k = Math.min(1, dt * 2.5);
    const targetLift = Math.sin(t * 0.55 + params.phase) * (state === 'thinking' ? 1.1 : 0.6);
    const targetShear = Math.cos(t * 0.45 + params.phase) * 0.6;
    return Object.freeze({
      lift: pose.lift + (targetLift - pose.lift) * k,
      shear: pose.shear + (targetShear - pose.shear) * k,
      pulse: pose.pulse + (0.3 - pose.pulse) * k
    });
  }
  if (state === 'sleeping') {
    const k = Math.min(1, dt * 1.2);
    const targetLift = Math.sin(t * 0.2 + params.phase) * 0.35;
    return Object.freeze({
      lift: pose.lift + (targetLift - pose.lift) * k,
      shear: pose.shear + (0 - pose.shear) * k,
      pulse: pose.pulse + (0.15 - pose.pulse) * k
    });
  }
  if (state === 'sending' || state === 'receiving') {
    const direction = state === 'sending' ? 1 : -1;
    const burst = direction * Math.exp(-transientT * 7) * 3;
    return Object.freeze({
      lift: pose.lift,
      shear: burst,
      pulse: 1
    });
  }
  if (state === 'settling') {
    const k = Math.min(1, dt * 4.5);
    const next = {
      lift: pose.lift + (rest.lift - pose.lift) * k,
      shear: pose.shear + (rest.shear - pose.shear) * k,
      pulse: pose.pulse + (rest.pulse - pose.pulse) * k
    };
    if (Math.abs(next.lift - rest.lift) < 0.01 && Math.abs(next.shear - rest.shear) < 0.01 && Math.abs(next.pulse - rest.pulse) < 0.01) {
      return rest;
    }
    return Object.freeze(next);
  }
  return pose;
}

export function paintWright(params, geometry, pose, effects) {
  const stroke = params.strokeWidth;
  const light = params.lightStroke;
  const lighten = effects.lighten || 0;
  const off = effects.dx || 0;
  const pulse = 1 + pose.pulse * 0.08;
  const flashHue = effects.flash ? hueMix(params.hue, effects.flash.hue ?? params.hue, effects.flash.strength) : params.hue;
  const hueSecondary = effects.flash ? hueMix(params.hue2, flashHue, 0.5) : params.hue2;
  const lineLight = Math.min(90, 42 + lighten);
  const frameLight = Math.min(90, 30 + lighten);
  const frameYShift = pose.lift;
  const left = (geometry.frame.left + off).toFixed(1);
  const right = (geometry.frame.right + off).toFixed(1);
  const top = (geometry.frame.top + frameYShift).toFixed(1);
  const bottom = (geometry.frame.bottom + frameYShift).toFixed(1);
  const parts = [];

  parts.push('<rect x="' + left + '" y="' + top + '" width="' + (geometry.frame.right - geometry.frame.left).toFixed(1) +
    '" height="' + (geometry.frame.bottom - geometry.frame.top).toFixed(1) + '" fill="none" stroke="hsl(' + Math.round(flashHue) +
    ' 48% ' + Math.round(frameLight) + '%)" stroke-width="' + stroke + '"/>');

  for (const band of geometry.bands) {
    const y = band.y + frameYShift;
    const skew = pose.shear * (params.emphasis === 'horizontal' ? 1 : 0.4);
    const x1 = band.x1 + off;
    const x2 = band.x2 + off + skew;
    parts.push('<line x1="' + x1.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y.toFixed(1) +
      '" stroke="hsl(' + Math.round(hueSecondary) + ' 56% ' + Math.round(lineLight) +
      '%)" stroke-width="' + light + '" stroke-linecap="round"/>');
  }

  const accentX = (params.emphasis === 'vertical' ? geometry.frame.right - params.cantilever * 0.5 : geometry.frame.left + params.cantilever * 0.5) + off;
  const accentTop = geometry.frame.top + frameYShift;
  const accentBottom = geometry.frame.bottom + frameYShift;
  parts.push('<line x1="' + accentX.toFixed(1) + '" y1="' + accentTop.toFixed(1) + '" x2="' + accentX.toFixed(1) + '" y2="' + accentBottom.toFixed(1) +
    '" stroke="hsl(' + Math.round(flashHue) + ' 62% ' + Math.round(Math.min(92, lineLight + 10)) +
    '%)" stroke-width="' + (stroke * pulse).toFixed(2) + '" stroke-linecap="round"/>');

  return parts.join('');
}

export function flashWright(params, state) {
  if (state === 'done') return { hue: params.hue2, lighten: 16, shake: false };
  if (state === 'error') return { hue: 4, lighten: 14, shake: true };
  if (state === 'sending' || state === 'receiving') return { hue: params.hue, lighten: 10, shake: false };
  return null;
}

export const wright = defineVariant({
  id: 'wright',
  label: 'Wright Scaffold',
  spec: WRIGHT_SPEC_VERSION,
  derive: deriveWright,
  describe: describeWright,
  prepare: prepareWright,
  geometry: buildWright,
  pose: poseWright,
  animate: animateWright,
  paint: paintWright,
  flash: flashWright
});
