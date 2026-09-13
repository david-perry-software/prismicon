import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';

import { createRenderer, STATES } from '../src/core.js';
import { BUILT_IN_VARIANTS, validateVariant } from '../src/variants/index.js';
import { PALETTE } from '../src/variants/polyhedron.js';
import { cyrb53, mulberry32 } from '../src/variants/seed.js';
import {
  ORBIT_SPEC_VERSION,
  ORBIT_MAX_RINGS,
  ORBIT_MAX_NODES,
  ORBIT_CORE_MARKS,
  deriveOrbit,
  describeOrbit,
  buildOrbit,
  prepareOrbit,
  poseOrbit,
  animateOrbit,
  paintOrbit,
  flashOrbit,
  orbit
} from '../src/variants/orbit.js';

const SEEDS = ['maya', 'build-bot-7', 'Alice@X.com', 'Ada Lovelace', 'demo-agent'];
const TAU = Math.PI * 2;

const originalGlobals = {
  document: globalThis.document,
  IntersectionObserver: globalThis.IntersectionObserver,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  window: globalThis.window
};

afterEach(() => {
  Object.assign(globalThis, originalGlobals);
});

function installDom({ reducedMotion = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="glyph"></div><div id="scratch"></div></body></html>');
  const frameCallbacks = [];
  dom.window.matchMedia = (query) => ({
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
    media: query
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IntersectionObserver = undefined;
  globalThis.requestAnimationFrame = (callback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  };
  return {
    container: dom.window.document.getElementById('glyph'),
    scratch: dom.window.document.getElementById('scratch'),
    advanceAnimationFrame(now) {
      const callback = frameCallbacks.shift();
      assert.ok(callback, 'expected a queued animation frame');
      callback(now);
    },
    get animationFrames() {
      return frameCallbacks.length;
    }
  };
}

function localRenderer(core = { createRenderer }) {
  return core.createRenderer(BUILT_IN_VARIANTS);
}

function geometryNumbers(svg) {
  const numbers = [];
  for (const [, , n] of svg.matchAll(/(cx|cy|r)="(-?\d+(?:\.\d+)?)"/g)) numbers.push(Number(n));
  for (const [, d] of svg.matchAll(/ d="([^"]*)"/g)) {
    for (const [n] of d.matchAll(/-?\d+(?:\.\d+)?/g)) numbers.push(Number(n));
  }
  return numbers;
}

// ---------------------------------------------------------------- constants

test('constants: spec orbit-v1 and ring/node bounds', () => {
  assert.equal(ORBIT_SPEC_VERSION, 'orbit-v1');
  assert.equal(ORBIT_MAX_RINGS, 4);
  assert.equal(ORBIT_MAX_NODES, 4);
  assert.deepEqual([...ORBIT_CORE_MARKS], ['dot', 'plus', 'diamond']);
  assert.equal(orbit.id, 'orbit');
  assert.equal(orbit.label, 'Orbit');
  assert.equal(orbit.spec, ORBIT_SPEC_VERSION);
});

// ---------------------------------------------------------------- derivation

test('derive: deterministic, normalization-stable, frozen and shaped per orbit-v1', () => {
  for (const seed of SEEDS) {
    const p = deriveOrbit(seed);
    assert.deepEqual(deriveOrbit(seed), p);
    assert.deepEqual(deriveOrbit(` ${seed.toUpperCase()} `), p);
    assert.equal(p.spec, ORBIT_SPEC_VERSION);
    assert.equal(p.seed, seed.trim().toLowerCase());
    assert.ok(Number.isInteger(p.hash) && p.hash > 0);
    assert.ok(Number.isInteger(p.ringCount) && p.ringCount >= 2 && p.ringCount <= ORBIT_MAX_RINGS);
    assert.equal(p.nodeCounts.length, ORBIT_MAX_RINGS);
    for (const n of p.nodeCounts) assert.ok(Number.isInteger(n) && n >= 1 && n <= ORBIT_MAX_NODES);
    assert.equal(p.nodeAngles.length, ORBIT_MAX_RINGS * ORBIT_MAX_NODES);
    for (const a of p.nodeAngles) assert.ok(a >= 0 && a < TAU);
    assert.ok(p.coreMark >= 0 && p.coreMark < ORBIT_CORE_MARKS.length);
    assert.ok(PALETTE.includes(p.hue) && PALETTE.includes(p.hue2));
    assert.equal(p.hue, PALETTE[p.hash % PALETTE.length]);
    assert.equal(p.hue2, PALETTE[(PALETTE.indexOf(p.hue) + 4) % PALETTE.length]);
    assert.deepEqual(Object.keys(p).sort(),
      ['coreMark', 'hash', 'hue', 'hue2', 'nodeAngles', 'nodeCounts', 'ringCount', 'seed', 'spec']);
    assert.ok(Object.isFrozen(p) && Object.isFrozen(p.nodeCounts) && Object.isFrozen(p.nodeAngles));
  }
  assert.deepEqual(deriveOrbit(' Maya '), deriveOrbit('maya'));
});

test('derive: every one of the 22 spec draws is made regardless of ringCount', () => {
  // Fixture-free property check: replay the frozen draw order inline and prove
  // deriveOrbit consumes exactly ringCount, 4 nodeCounts, 16 nodeAngles, coreMark.
  for (const seed of SEEDS) {
    const p = deriveOrbit(seed);
    const r = mulberry32(cyrb53(seed.trim().toLowerCase()));
    assert.equal(p.ringCount, 2 + Math.floor(r() * (ORBIT_MAX_RINGS - 1)), 'draw 1: ringCount');
    for (let i = 0; i < ORBIT_MAX_RINGS; i += 1) {
      assert.equal(p.nodeCounts[i], 1 + Math.floor(r() * ORBIT_MAX_NODES), `draw ${2 + i}: nodeCounts[${i}]`);
    }
    for (let i = 0; i < ORBIT_MAX_RINGS * ORBIT_MAX_NODES; i += 1) {
      assert.equal(p.nodeAngles[i], r() * TAU, `draw ${6 + i}: nodeAngles[${i}]`);
    }
    assert.equal(p.coreMark, Math.floor(r() * ORBIT_CORE_MARKS.length), 'draw 22: coreMark');
  }
  const ringCounts = new Set(SEEDS.map((seed) => deriveOrbit(seed).ringCount));
  assert.ok(ringCounts.size > 1, 'golden seeds exercise more than one ringCount');
});

// ---------------------------------------------------------------- describe

test('describe: "<rings>-ring orbit, <nodes> nodes, <mark> core"', () => {
  assert.equal(describeOrbit({ ringCount: 3, nodeCounts: [3, 3, 3, 1], coreMark: 2 }), '3-ring orbit, 9 nodes, diamond core');
  assert.equal(describeOrbit({ ringCount: 2, nodeCounts: [1, 4, 2, 2], coreMark: 1 }), '2-ring orbit, 5 nodes, plus core');
  for (const seed of SEEDS) {
    const p = deriveOrbit(seed);
    const nodes = p.nodeCounts.slice(0, p.ringCount).reduce((sum, n) => sum + n, 0);
    assert.equal(describeOrbit(p), `${p.ringCount}-ring orbit, ${nodes} nodes, ${ORBIT_CORE_MARKS[p.coreMark]} core`);
  }
});

// ---------------------------------------------------------------- geometry

test('geometry: radii spread evenly up to 26, slots slice the spec angles, all frozen', () => {
  for (const seed of SEEDS) {
    const p = deriveOrbit(seed);
    const geo = buildOrbit(p);
    assert.ok(Object.isFrozen(geo) && Object.isFrozen(geo.radii) && Object.isFrozen(geo.slots));
    assert.equal(geo.radii.length, p.ringCount);
    for (let r = 0; r < p.ringCount; r += 1) {
      assert.equal(geo.radii[r], (26 * (r + 1)) / p.ringCount, `radius ${r}`);
      assert.ok(Object.isFrozen(geo.slots[r]));
      assert.deepEqual([...geo.slots[r]], [...p.nodeAngles.slice(r * ORBIT_MAX_NODES, r * ORBIT_MAX_NODES + p.nodeCounts[r])]);
    }
    assert.deepEqual(buildOrbit(p), geo, 'stable across calls');
  }
});

// ---------------------------------------------------------------- static hooks

test('hooks: pose returns the same frozen rest pose for every state', () => {
  for (const seed of SEEDS) {
    const p = deriveOrbit(seed);
    const rest = poseOrbit(p, 'idle');
    assert.ok(Object.isFrozen(rest) && Object.isFrozen(rest.offsets));
    assert.deepEqual(rest, { offsets: Array.from({ length: p.ringCount }, () => 0), coreScale: 1 });
    for (const state of [...STATES, 'settling']) {
      assert.deepEqual(poseOrbit(p, state), rest, state);
    }
  }
});

test('hooks: animate returns its input for idle/done/error and ctx.rest for settling', () => {
  const p = prepareOrbit(deriveOrbit('maya'), { size: 64 });
  const rest = poseOrbit(p, 'idle');
  const pose = Object.freeze({ offsets: Object.freeze([0.5, -0.5, 0.25, 0.75]), coreScale: 1.4 });
  for (const state of ['idle', 'done', 'error']) {
    assert.equal(animateOrbit(pose, { params: p, state, dt: 1 / 30, t: 1, transientT: 0.1, rest }), pose, state);
  }
  assert.equal(animateOrbit(pose, { params: p, state: 'settling', dt: 1 / 30, t: 1, transientT: 0, rest }), rest);
});

test('hooks: validateVariant passes for orbit', () => {
  let validated;
  assert.doesNotThrow(() => { validated = validateVariant(orbit); });
  assert.equal(validated.id, 'orbit');
});

test('hooks: flash mirrors the shared lifecycle mapping', () => {
  const p = deriveOrbit('maya');
  assert.deepEqual(flashOrbit(p, 'receiving'), { hue: p.hue, lighten: 26 });
  assert.deepEqual(flashOrbit(p, 'done'), { hue: 145 });
  assert.deepEqual(flashOrbit(p, 'error'), { hue: 4, shake: true });
  for (const state of STATES) {
    if (['receiving', 'done', 'error'].includes(state)) continue;
    assert.equal(flashOrbit(p, state), null, state);
  }
});

// ---------------------------------------------------------------- painting

test('paint: renders rings, nodes and a core mark and honors dark/dx/sleeping/lighten/flash', () => {
  for (const seed of SEEDS) {
    const p = prepareOrbit(deriveOrbit(seed), { size: 64 });
    const geo = buildOrbit(p);
    const pose = poseOrbit(p, 'idle');
    const light = paintOrbit(p, geo, pose, { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null });
    assert.match(light, /^<circle /, seed);
    const dark = paintOrbit(p, geo, pose, { dark: true, sleeping: false, dx: 0, lighten: 0, flash: null });
    assert.notEqual(dark, light, 'dark mode changes the ink');
    const shifted = paintOrbit(p, geo, pose, { dark: false, sleeping: false, dx: 3, lighten: 0, flash: null });
    assert.notEqual(shifted, light, 'dx shifts the glyph');
    const sleeping = paintOrbit(p, geo, pose, { dark: false, sleeping: true, dx: 0, lighten: 0, flash: null });
    assert.notEqual(sleeping, light, 'sleeping dims the ramp');
    const flashed = paintOrbit(p, geo, pose, { dark: false, sleeping: false, dx: 0, lighten: 10, flash: { hue: 145, strength: 0.75 } });
    assert.notEqual(flashed, light, 'flash and lighten recolor');
  }
});

test('paint: every emitted coordinate stays inside the viewBox at rest', () => {
  for (const seed of SEEDS) {
    const p = prepareOrbit(deriveOrbit(seed), { size: 64 });
    const svg = paintOrbit(p, buildOrbit(p), poseOrbit(p, 'idle'), { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null });
    const nums = geometryNumbers(svg);
    assert.ok(nums.length > 0);
    for (const n of nums) assert.ok(n >= 0 && n <= 100, `${seed}: ${n} outside viewBox`);
  }
});

// ---------------------------------------------------------------- rendering

test('render: static SVG names the anatomy and stays inside the viewBox', () => {
  const { renderStaticSVG } = localRenderer();
  for (const seed of SEEDS) {
    const svg = renderStaticSVG(seed, { variant: 'orbit' });
    const p = deriveOrbit(seed);
    assert.ok(svg.includes(`${p.ringCount}-ring orbit`), `${seed} aria-label names the anatomy`);
    const nums = geometryNumbers(svg);
    assert.ok(nums.length > 0);
    for (const n of nums) assert.ok(n >= 0 && n <= 100, `${seed}: ${n} outside viewBox`);
  }
});

test('render: static markup equals the mounted markup at rest', async () => {
  const dom = installDom();
  const core = await import('../src/core.js?orbit-parity');
  const { renderStaticSVG, mountGlyph } = localRenderer(core);
  for (const seed of SEEDS) {
    dom.scratch.innerHTML = renderStaticSVG(seed, { variant: 'orbit', dark: false });
    const staticInner = dom.scratch.querySelector('svg > g').innerHTML;
    const handle = mountGlyph(dom.container, seed, { variant: 'orbit', dark: false });
    assert.equal(handle.variant, 'orbit');
    assert.deepEqual(handle.params, prepareOrbit(deriveOrbit(seed), { size: 64 }));
    assert.equal(dom.container.querySelector('svg > g').innerHTML, staticInner, seed);
    handle.destroy();
  }
});

test('render: reduced motion mount queues no frames and equals the static markup in every state', async () => {
  const dom = installDom({ reducedMotion: true });
  const core = await import('../src/core.js?orbit-reduced');
  const { renderStaticSVG, mountGlyph } = localRenderer(core);
  const handle = mountGlyph(dom.container, 'Ada Lovelace', { variant: 'orbit', state: 'working', dark: false });
  assert.equal(dom.animationFrames, 0);
  dom.scratch.innerHTML = renderStaticSVG('Ada Lovelace', { variant: 'orbit', dark: false });
  const staticInner = dom.scratch.querySelector('svg > g').innerHTML;
  const inner = () => dom.container.querySelector('svg > g').innerHTML;
  assert.equal(inner(), staticInner);
  for (const state of STATES) {
    handle.setState(state);
    if (state === 'sleeping') assert.notEqual(inner(), staticInner, 'sleeping repaints with the dimmer ramp');
    else assert.equal(inner(), staticInner, state);
    assert.equal(dom.animationFrames, 0, state);
  }
  handle.setState('idle');
  assert.equal(inner(), staticInner);
  handle.destroy();
});
