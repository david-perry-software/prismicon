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
export const WRIGHT_VIEWBOX_BOUNDS = Object.freeze({ min: 5, max: 95 });
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- palette system

export const WRIGHT_PALETTE_FAMILIES = Object.freeze(['textile', 'stained-glass', 'concrete-wood']);
export const WRIGHT_CONTRAST_MIN = 3;
export const WRIGHT_RED_AREA_CEILING = 0.10;

// Each structural role is checked against the single adjacent surface it is
// actually painted on: the primary-mass outline and the horizontal-plane fill
// both read against the canvas, grid/decoration lines read against the plane
// fill, and the restrained red accent reads against the canvas.
export const WRIGHT_CONTRAST_PAIRS = Object.freeze([
  Object.freeze(['canvas', 'primary']),
  Object.freeze(['canvas', 'secondary']),
  Object.freeze(['secondary', 'line']),
  Object.freeze(['canvas', 'accent'])
]);

export const WRIGHT_PALETTES = Object.freeze({
  textile: Object.freeze({
    light: Object.freeze({ canvas: '#f6f1e6', primary: '#6f5a3e', secondary: '#8f7956', line: '#2e2417', accent: '#9c3a2b' }),
    dark: Object.freeze({ canvas: '#1a1712', primary: '#cbb086', secondary: '#7d6b4c', line: '#e6d9ba', accent: '#c96b4f' })
  }),
  'stained-glass': Object.freeze({
    light: Object.freeze({ canvas: '#eef3f5', primary: '#2c5968', secondary: '#668998', line: '#10242c', accent: '#8e2e39' }),
    dark: Object.freeze({ canvas: '#0f1519', primary: '#6ba4b8', secondary: '#4a7383', line: '#c3d8df', accent: '#c9606e' })
  }),
  'concrete-wood': Object.freeze({
    light: Object.freeze({ canvas: '#eeebe5', primary: '#5c6164', secondary: '#8a7758', line: '#262a2d', accent: '#9c3b2a' }),
    dark: Object.freeze({ canvas: '#17191b', primary: '#bcc0c3', secondary: '#7d7666', line: '#d9d5cb', accent: '#c2694f' })
  })
});

export function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((ch) => ch + ch).join('') : value;
  const num = parseInt(full, 16);
  return Object.freeze([(num >> 16) & 255, (num >> 8) & 255, num & 255]);
}

export function relativeLuminance(rgb) {
  const linear = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHex(rgb) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + rgb.map((n) => clamp(n).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(rgb) {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

function hslToRgb(hsl) {
  const [h, s, l] = hsl;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  return rgb.map((v) => Math.round((v + m) * 255));
}

function lightenHex(hex, amount) {
  return rgbToHex(hexToRgb(hex).map((channel) => channel + (255 - channel) * amount));
}

function shiftHue(hex, hue, strength) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  const d = ((hue - h + 540) % 360) - 180;
  return rgbToHex(hslToRgb([(h + d * strength + 360) % 360, s, l]));
}

function ensureContrast(role, against, min) {
  let current = role;
  for (let i = 0; i < 64; i += 1) {
    if (contrastRatio(current, against) >= min) return current;
    const [h, s, l] = rgbToHsl(hexToRgb(current));
    // Move the role away from its adjacent surface in lightness: lighten a role
    // that is lighter than the surface, darken a role that is darker than it.
    const direction = relativeLuminance(hexToRgb(current)) >= relativeLuminance(hexToRgb(against)) ? 1 : -1;
    current = rgbToHex(hslToRgb([h, s, Math.max(0, Math.min(1, l + direction * 0.02))]));
  }
  return current;
}

function enforcePaletteContrast(roles, pairs, min) {
  const resolved = { ...roles };
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const [against, role] of pairs) {
      const adjusted = ensureContrast(resolved[role], resolved[against], min);
      if (adjusted !== resolved[role]) {
        resolved[role] = adjusted;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return resolved;
}

function resolveWrightRoles(params, effects) {
  const mode = WRIGHT_PALETTES[params.paletteFamily][effects.dark ? 'dark' : 'light'];
  const roles = {
    canvas: mode.canvas,
    primary: mode.primary,
    secondary: mode.secondary,
    line: mode.line,
    accent: mode.accent
  };
  const lightenAmount = Math.min(0.25, (effects.lighten || 0) / 100);
  if (lightenAmount > 0) {
    for (const role of ['primary', 'secondary', 'line', 'accent']) {
      roles[role] = lightenHex(roles[role], lightenAmount);
    }
  }
  if (effects.flash) {
    const hue = effects.flash.hue ?? params.hue;
    const strength = Math.min(1, Math.max(0, effects.flash.strength ?? 0));
    roles.accent = shiftHue(roles.accent, hue, strength);
  }
  return enforcePaletteContrast(roles, WRIGHT_CONTRAST_PAIRS, WRIGHT_CONTRAST_MIN);
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
  const paletteFamily = WRIGHT_PALETTE_FAMILIES[Math.floor(hash / 2 ** 40) % WRIGHT_PALETTE_FAMILIES.length];
  return Object.freeze({
    spec: WRIGHT_SPEC_VERSION,
    seed: norm,
    hash,
    paletteFamily,
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

// ---------------------------------------------------------------- motion traits (tunable, non-identity)

/**
 * Motion traits are derived from disjoint bit-ranges of the seed hash (bits
 * 42-52, above the bits `deriveWright` already consumes for `phase` and
 * `paletteFamily`) — never new PRNG draws — so `deriveWright` output, the
 * static portrait, and `WRIGHT_SPEC_VERSION` stay frozen.
 */
function wrightMotionTraits(params) {
  const { hash } = params;
  return {
    sweepDir: Math.floor(hash / 2 ** 42) % 2 === 0 ? 1 : -1,
    panelPhase: ((Math.floor(hash / 2 ** 43) % 64) / 63) * TAU,
    illumSpeed: 0.7 + ((Math.floor(hash / 2 ** 49) % 16) / 15) * 0.6
  };
}

export function prepareWright(params, { size }) {
  return {
    ...params,
    strokeWidth: size < 28 ? 3 : 2.2,
    lightStroke: size < 28 ? 1.8 : 1.3,
    ...wrightMotionTraits(params)
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
    const x = Math.max(WRIGHT_VIEWBOX_BOUNDS.min, left - cantilever);
    const right = Math.min(WRIGHT_VIEWBOX_BOUNDS.max, left + profile.width + (index % 2 === 0 ? cantilever : 0));
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
  return Object.freeze({
    primaryMasses: freezeItems(primaryMasses),
    horizontalPlanes: freezeItems(horizontalPlanes),
    gridModules: freezeItems(gridModules),
    decorations: freezeItems(decorations),
    accents: freezeItems(accents)
  });
}

/**
 * Estimate the rendered painted area of every semantic layer — fill area for the
 * horizontal planes and stroke footprint for outlined/stroked layers — and return
 * the red accent's share of the total. The red contribution comes from stroke
 * footprint only (never element count), and `pulse` mirrors the accent width
 * scaling applied in `paintWright`.
 */
export function paintedAreaMetrics(geometry, params, pulse = 1) {
  const rectFootprint = (item, width) => 2 * (item.width + item.height) * width;
  const lineFootprint = (item, width) => Math.hypot(item.x2 - item.x1, item.y2 - item.y1) * width;
  let red = 0;
  let total = 0;
  for (const mass of geometry.primaryMasses) total += rectFootprint(mass, params.strokeWidth);
  for (const plane of geometry.horizontalPlanes) total += plane.width * plane.height;
  for (const module of geometry.gridModules) total += rectFootprint(module, params.lightStroke);
  for (const decoration of geometry.decorations) total += lineFootprint(decoration, params.lightStroke);
  for (const accent of geometry.accents) {
    const area = lineFootprint(accent, accent.width * pulse);
    red += area;
    total += area;
  }
  return Object.freeze({ red, total, ratio: total > 0 ? red / total : 0 });
}

export function poseWright(params, state) {
  if (state === 'working') return Object.freeze({ illuminate: 0, panelPulse: 0.5, settle: 0 });
  return Object.freeze({ illuminate: -1, panelPulse: 0, settle: 0 });
}

export function animateWright(pose, ctx) {
  const { params, state, dt, t, rest, transientT } = ctx;
  if (state === 'idle' || state === 'done' || state === 'error') return pose;
  const ease = (cur, target, k) => cur + (target - cur) * Math.min(1, k);

  if (state === 'working') {
    // Steady illumination sweep down the planes plus a gentle panel pulse and a
    // slow structural rise/fall — the active "working" state reads as a lit,
    // breathing architectural composition.
    return Object.freeze({
      illuminate: 0.5 + 0.5 * Math.sin(t * 0.8 * params.illumSpeed * params.sweepDir + params.phase),
      panelPulse: 0.5 + 0.35 * Math.sin(t * 1.3 + params.phase * 1.7),
      settle: 0.4 * Math.sin(t * 0.7 + params.phase)
    });
  }
  if (state === 'waiting') {
    // A single slow illumination drift with the panels nearly at rest.
    const k = dt * 2.5;
    const sweep = 0.5 + 0.45 * Math.sin(t * 0.35 * params.illumSpeed * params.sweepDir + params.phase);
    return Object.freeze({
      illuminate: ease(pose.illuminate, sweep, k),
      panelPulse: ease(pose.panelPulse, 0.18, k),
      settle: ease(pose.settle, 0, k)
    });
  }
  if (state === 'thinking') {
    // A faster sequential scan with a sharper panel-pulse beat — panels "step"
    // as the illumination path sweeps.
    const k = dt * 3;
    const sweep = 0.5 + 0.5 * Math.sin(t * 1.4 * params.illumSpeed * params.sweepDir + params.phase * 0.9);
    const beat = 0.5 + 0.5 * Math.sin(t * 2.1 + params.phase);
    return Object.freeze({
      illuminate: ease(pose.illuminate, sweep, k),
      panelPulse: ease(pose.panelPulse, 0.3 + 0.5 * beat, k),
      settle: ease(pose.settle, 0.25 * Math.sin(t * 1.0 + params.phase), k)
    });
  }
  if (state === 'sleeping') {
    // Very slow, dim breath — illumination fades out and panels barely stir.
    const k = dt * 1.2;
    return Object.freeze({
      illuminate: ease(pose.illuminate, -1, k),
      panelPulse: ease(pose.panelPulse, 0.08 + 0.04 * Math.sin(t * 0.3 + params.phase), k),
      settle: ease(pose.settle, 0, k)
    });
  }
  if (state === 'sending' || state === 'receiving') {
    // Transient outward (sending) / inward (receiving) illumination burst that
    // decays over transientT; the structure itself stays settled.
    const sweep = state === 'sending' ? transientT / 0.4 : 1 - transientT / 0.4;
    return Object.freeze({
      illuminate: Math.max(0, Math.min(1, sweep)),
      panelPulse: 0.9 * Math.exp(-transientT * 7),
      settle: 0
    });
  }
  if (state === 'settling') {
    // Structural settle/reconstruct: every field eases back to the rest pose,
    // and once close enough the engine resumes `idle` by identity.
    const k = dt * 4.5;
    const next = {
      illuminate: ease(pose.illuminate, rest.illuminate, k),
      panelPulse: ease(pose.panelPulse, rest.panelPulse, k),
      settle: ease(pose.settle, rest.settle, k)
    };
    if (Math.abs(next.illuminate - rest.illuminate) < 0.01 &&
        Math.abs(next.panelPulse - rest.panelPulse) < 0.01 &&
        Math.abs(next.settle - rest.settle) < 0.01) {
      return rest;
    }
    return Object.freeze(next);
  }
  return pose;
}

export function paintWright(params, geometry, pose, effects) {
  const stroke = params.strokeWidth;
  const light = params.lightStroke;
  const off = effects.dx || 0;
  const settle = (pose.settle || 0) * 2.4;
  const sweep = pose.illuminate;
  const panelAmp = pose.panelPulse || 0;
  const roles = resolveWrightRoles(params, effects);

  // Illumination path: lighten the horizontal plane nearest the sweep position,
  // falling off with distance. The lightened fill is re-checked against the
  // canvas so the 3:1 contrast invariant survives illumination. `sweep < 0`
  // (the rest pose) disables the path and keeps the frozen role color exact.
  const planeCount = geometry.horizontalPlanes.length;
  const planeFill = (index) => {
    if (sweep == null || sweep < 0) return roles.secondary;
    const center = sweep * Math.max(0, planeCount - 1);
    const intensity = Math.max(0, 1 - Math.abs(index - center) * 1.6) * 0.16;
    if (intensity <= 0) return roles.secondary;
    return ensureContrast(lightenHex(roles.secondary, intensity), roles.canvas, WRIGHT_CONTRAST_MIN);
  };

  const rect = (layer, item, attributes, dy = 0) => '<rect data-wright-layer="' + layer + '" x="' + (item.x + off).toFixed(1) +
    '" y="' + (item.y + dy).toFixed(1) + '" width="' + item.width.toFixed(1) + '" height="' + item.height.toFixed(1) + '" ' + attributes + '/>';
  const line = (layer, item, attributes, dy = 0) => '<line data-wright-layer="' + layer + '" x1="' + (item.x1 + off).toFixed(1) +
    '" y1="' + (item.y1 + dy).toFixed(1) + '" x2="' + (item.x2 + off).toFixed(1) + '" y2="' +
    (item.y2 + dy).toFixed(1) + '" ' + attributes + '/>';
  const parts = [];

  for (const mass of geometry.primaryMasses) {
    parts.push(rect('primary-mass', mass, 'fill="none" stroke="' + roles.primary + '" stroke-width="' + stroke + '"'));
  }
  geometry.horizontalPlanes.forEach((plane, index) => {
    parts.push(rect('horizontal-plane', plane,
      'fill="' + planeFill(index) + '"', settle));
  });
  geometry.gridModules.forEach((module, index) => {
    // Panel pulse: a bounded, spatially varying stroke-width swell. At rest
    // (panelAmp 0) the stroke is emitted exactly as before for byte-identical
    // static output.
    const pulseScale = panelAmp > 0 ? 1 + panelAmp * 0.55 * Math.sin(index * 2.39996 + params.phase + params.panelPhase) : 1;
    const moduleStroke = panelAmp > 0 ? (light * pulseScale).toFixed(2) : light;
    parts.push(rect('grid-module', module,
      'fill="none" stroke="' + roles.line + '" stroke-width="' + moduleStroke + '"'));
  });
  for (const decoration of geometry.decorations) {
    parts.push(line('decoration', decoration,
      'stroke="' + roles.line + '" stroke-width="' + light + '" stroke-linecap="round"'));
  }
  for (const accent of geometry.accents) {
    parts.push(line('accent', accent,
      'stroke="' + roles.accent + '" stroke-width="' + accent.width.toFixed(2) + '" stroke-linecap="round"'));
  }

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
