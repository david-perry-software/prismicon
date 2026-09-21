/**
 * prismicon Wright scaffold variant — contract-valid placeholder for the future
 * Frank Lloyd Wright family. This is intentionally a spec + hook scaffold only.
 */

import { defineVariant } from './registry.js';
import { cyrb53, mulberry32 } from './seed.js';
import { PALETTE, normalizeSeed } from './polyhedron.js';

export const WRIGHT_SPEC_VERSION = 'wright-geometry-v1';
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
export const WRIGHT_LAYER_LIMITS = Object.freeze({
  primaryMasses: 2,
  horizontalPlanes: 5,
  gridModules: 25,
  decorations: 8,
  accents: 2
});
const TAU = Math.PI * 2;

function hueMix(a, b, t) {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

export function deriveWright(seed) {
  const norm = normalizeSeed(seed);
  const hash = cyrb53(norm);
  const random = mulberry32(hash);
  const draws = Array.from({ length: WRIGHT_DRAW_ORDER.length }, () => random());
  const dominantFamily = WRIGHT_FAMILIES[Math.floor(draws[0] * WRIGHT_FAMILIES.length)];
  const hybrid = draws[1] < 0.5;
  const compatibleFamilies = WRIGHT_HYBRID_COMPATIBILITY[dominantFamily];
  const secondaryFamily = hybrid
    ? compatibleFamilies[Math.floor(draws[2] * compatibleFamilies.length)]
    : null;
  const massWidth = 52 + Math.floor(draws[3] * 17);
  const massHeight = 38 + Math.floor(draws[4] * 17);
  const massOffset = -8 + Math.floor(draws[5] * 17);
  const planeCount = 3 + Math.floor(draws[6] * 3);
  const planeSpread = 6 + Math.floor(draws[7] * 5);
  const gridColumns = 2 + Math.floor(draws[8] * 4);
  const gridRows = 2 + Math.floor(draws[9] * 4);
  const decoration = Math.floor(draws[10] * 3);
  const accent = Math.floor(draws[11] * 4);
  const phase = ((Math.floor(hash / 2 ** 32) % 256) / 255) * TAU;
  const hueIdx = hash % PALETTE.length;
  return Object.freeze({
    spec: WRIGHT_SPEC_VERSION,
    seed: norm,
    hash,
    dominantFamily,
    secondaryFamily,
    massWidth,
    massHeight,
    massOffset,
    planeCount,
    planeSpread,
    gridColumns,
    gridRows,
    decoration,
    accent,
    lineCount: planeCount,
    inset: Math.round((100 - massWidth) / 2),
    horizon: 50 + massOffset,
    cantilever: 8 + planeSpread,
    emphasis: dominantFamily === 'art-glass' || dominantFamily === 'textile-block' ? 'vertical' : 'horizontal',
    phase,
    hue: PALETTE[hueIdx],
    hue2: PALETTE[(hueIdx + 5) % PALETTE.length]
  });
}

export function describeWright(params) {
  const hybrid = params.secondaryFamily ? ` with ${params.secondaryFamily} detail` : '';
  return `${params.dominantFamily} Wright composition${hybrid}, ${params.planeCount} planes`;
}

export function prepareWright(params, { size }) {
  return {
    ...params,
    strokeWidth: size < 28 ? 3 : 2.2,
    lightStroke: size < 28 ? 1.8 : 1.3
  };
}

export function buildWright(params) {
  const profiles = {
    prairie: { width: Math.max(64, params.massWidth), height: Math.min(36, params.massHeight), columns: 3, rows: 2 },
    'art-glass': { width: Math.min(52, params.massWidth), height: Math.max(54, params.massHeight), columns: params.gridColumns, rows: params.gridRows },
    'textile-block': { width: 54, height: 54, columns: params.gridColumns, rows: params.gridRows },
    usonian: { width: Math.max(60, params.massWidth), height: Math.min(44, params.massHeight), columns: 3, rows: 2 }
  };
  const profile = profiles[params.dominantFamily];
  const centerX = Math.max(42, Math.min(58, 50 + params.massOffset));
  const left = Math.max(8, Math.min(92 - profile.width, centerX - profile.width / 2));
  const top = 50 - profile.height / 2;
  const primaryMasses = [{ x: left, y: top, width: profile.width, height: profile.height }];
  if (params.dominantFamily === 'usonian') {
    primaryMasses.push({ x: left + profile.width * 0.58, y: top + profile.height * 0.2, width: profile.width * 0.32, height: profile.height * 0.6 });
  }

  const horizontalPlanes = Array.from({ length: params.planeCount }, (_, index) => {
    const y = top + ((index + 1) * profile.height) / (params.planeCount + 1);
    const cantilever = index % 2 === 0 ? params.planeSpread : params.planeSpread * 0.45;
    const x = Math.max(5, left - cantilever);
    const right = Math.min(95, left + profile.width + (index % 2 === 0 ? cantilever : 0));
    return { x, y: y - 0.8, width: right - x, height: 1.6 };
  });

  const gridInset = 5;
  const gridLeft = left + gridInset;
  const gridTop = top + gridInset;
  const gridWidth = profile.width - gridInset * 2;
  const gridHeight = profile.height - gridInset * 2;
  const cellWidth = gridWidth / profile.columns;
  const cellHeight = gridHeight / profile.rows;
  const gridModules = Array.from({ length: profile.columns * profile.rows }, (_, index) => ({
    x: gridLeft + (index % profile.columns) * cellWidth + 1,
    y: gridTop + Math.floor(index / profile.columns) * cellHeight + 1,
    width: Math.max(1, cellWidth - 2),
    height: Math.max(1, cellHeight - 2)
  }));

  const decorationCount = Math.min(WRIGHT_LAYER_LIMITS.decorations, 2 + params.decoration * 2 + (params.secondaryFamily ? 2 : 0));
  const decorations = Array.from({ length: decorationCount }, (_, index) => {
    const module = gridModules[index % gridModules.length];
    const reverse = (index + params.accent) % 2 === 1;
    return {
      x1: reverse ? module.x + module.width : module.x,
      y1: module.y,
      x2: reverse ? module.x : module.x + module.width,
      y2: module.y + module.height
    };
  });
  const accentX = params.accent % 2 === 0 ? left + profile.width * 0.28 : left + profile.width * 0.72;
  const accents = [{ x1: accentX, y1: top, x2: accentX, y2: top + profile.height, width: 2.2 }];

  const freezeItems = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
  const frame = Object.freeze({ left, right: left + profile.width, top, bottom: top + profile.height });
  const bands = freezeItems(horizontalPlanes.map((plane) => ({
    y: plane.y + plane.height / 2,
    x1: plane.x,
    x2: plane.x + plane.width
  })));
  return Object.freeze({
    primaryMasses: freezeItems(primaryMasses),
    horizontalPlanes: freezeItems(horizontalPlanes),
    gridModules: freezeItems(gridModules),
    decorations: freezeItems(decorations),
    accents: freezeItems(accents),
    frame,
    bands
  });
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
