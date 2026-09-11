import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';

import { createRenderer, STATES } from '../src/core.js';
import { createVariantRegistry } from '../src/variants/registry.js';
import { polyhedron, PALETTE, FINISH_NAMES } from '../src/variants/polyhedron.js';
import {
  NCUBE_SPEC_VERSION,
  NCUBE_MIN_DIMENSION,
  NCUBE_MAX_DIMENSION,
  NCUBE_NAMES,
  buildNcube,
  deriveNcube,
  describeNcube,
  poseNcube,
  animateNcube,
  flashNcube,
  ncube,
  ncubeVariants
} from '../src/variants/ncube.js';

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

function dimensions() {
  const out = [];
  for (let d = NCUBE_MIN_DIMENSION; d <= NCUBE_MAX_DIMENSION; d += 1) out.push(d);
  return out;
}

function choose2(d) {
  return (d * (d - 1)) / 2;
}

function localRenderer(core = { createRenderer }) {
  return core.createRenderer(createVariantRegistry([polyhedron, ...ncubeVariants], { defaultId: 'polyhedron' }));
}

function pathNumbers(svg) {
  const numbers = [];
  for (const [, d] of svg.matchAll(/ d="([^"]*)"/g)) {
    for (const [n] of d.matchAll(/-?\d+(?:\.\d+)?/g)) numbers.push(Number(n));
  }
  return numbers;
}

// ---------------------------------------------------------------- constants

test('constants: spec ncube-v1, dimension range, names cover every dimension', () => {
  assert.equal(NCUBE_SPEC_VERSION, 'ncube-v1');
  assert.equal(NCUBE_MIN_DIMENSION, 3);
  assert.ok(Number.isInteger(NCUBE_MAX_DIMENSION) && NCUBE_MAX_DIMENSION >= NCUBE_MIN_DIMENSION);
  assert.equal(NCUBE_NAMES[3], 'cube');
  assert.equal(NCUBE_NAMES[4], 'tesseract');
  for (const d of dimensions()) assert.equal(typeof NCUBE_NAMES[d], 'string', `NCUBE_NAMES[${d}]`);
});

// ---------------------------------------------------------------- geometry

test('geometry: buildNcube counts match 2^d vertices, d*2^(d-1) edges, C(d,2)*2^(d-2) faces', () => {
  for (const d of dimensions()) {
    const geo = buildNcube(d);
    assert.equal(geo.dimension, d);
    assert.equal(geo.V.length, 2 ** d, `vertices d=${d}`);
    assert.equal(geo.edges.length, d * 2 ** (d - 1), `edges d=${d}`);
    assert.equal(geo.faces.length, choose2(d) * 2 ** (d - 2), `faces d=${d}`);
  }
});

test('geometry: vertices are ±1 vectors, edges differ in exactly one bit, faces are in-range squares', () => {
  for (const d of dimensions()) {
    const geo = buildNcube(d);
    const n = geo.V.length;
    geo.V.forEach((v, i) => {
      assert.equal(v.length, d);
      v.forEach((c, axis) => {
        assert.ok(c === 1 || c === -1, `vertex ${i} axis ${axis} is ±1`);
        assert.equal(c, (i >> axis) & 1 ? 1 : -1, `vertex ${i} axis ${axis} follows index bits`);
      });
    });
    for (const [a, b] of geo.edges) {
      assert.ok(a >= 0 && a < n && b >= 0 && b < n, `edge ${a}-${b} in range d=${d}`);
      const diff = a ^ b;
      assert.ok(diff !== 0 && (diff & (diff - 1)) === 0, `edge ${a}-${b} differs in one bit`);
    }
    for (const f of geo.faces) {
      assert.equal(f.v.length, 4);
      for (const i of f.v) assert.ok(i >= 0 && i < n, `face index ${i} in range d=${d}`);
      assert.equal(new Set(f.v).size, 4);
      assert.ok(Number.isInteger(f.axes[0]) && Number.isInteger(f.axes[1]) && f.axes[0] < f.axes[1]);
    }
  }
});

test('geometry: result is frozen and stable across calls', () => {
  const a = buildNcube(4);
  const b = buildNcube(4);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.V) && Object.isFrozen(a.edges) && Object.isFrozen(a.faces));
  assert.deepEqual(a, b);
  for (const v of ncubeVariants) {
    const p = v.derive('maya');
    assert.deepEqual(v.geometry(p), buildNcube(p.dimension));
  }
});

// ---------------------------------------------------------------- derivation

test('derive: deterministic, normalization-stable and shaped per ncube-v1', () => {
  for (const seed of SEEDS) {
    const p = deriveNcube(seed);
    assert.deepEqual(deriveNcube(seed), p);
    assert.deepEqual(deriveNcube(` ${seed.toUpperCase()} `), p);
    assert.equal(p.spec, NCUBE_SPEC_VERSION);
    assert.equal(p.seed, seed.trim().toLowerCase());
    assert.ok(Number.isInteger(p.hash) && p.hash > 0);
    assert.ok(p.dimension >= NCUBE_MIN_DIMENSION && p.dimension <= NCUBE_MAX_DIMENSION);
    assert.ok([0, 1, 2].includes(p.finish));
    assert.equal(p.theta.length, NCUBE_MAX_DIMENSION - 3);
    for (const t of p.theta) assert.ok(t >= 0 && t < TAU);
    for (const a of [p.ax, p.ay, p.az]) assert.ok(a >= 0 && a < TAU);
    assert.ok(PALETTE.includes(p.hue) && PALETTE.includes(p.hue2));
    assert.equal(p.hue, PALETTE[p.hash % PALETTE.length]);
    assert.equal(p.hue2, PALETTE[(PALETTE.indexOf(p.hue) + 4) % PALETTE.length]);
    assert.deepEqual(Object.keys(p).sort(), ['ax', 'ay', 'az', 'dimension', 'finish', 'hash', 'hue', 'hue2', 'seed', 'spec', 'theta']);
  }
  assert.deepEqual(deriveNcube(' Maya '), deriveNcube('maya'));
});

test('derive: per-dimension override changes only dimension', () => {
  for (const seed of SEEDS) {
    const base = deriveNcube(seed);
    for (const d of dimensions()) {
      const fixed = deriveNcube(seed, d);
      assert.equal(fixed.dimension, d);
      assert.deepEqual({ ...fixed, dimension: base.dimension }, base);
    }
  }
});

test('derive: the ncube-<d> descriptors derive exactly deriveNcube(seed, d) and ncube derives the seed dimension', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(ncube.derive(seed), deriveNcube(seed));
    for (const v of ncubeVariants.slice(1)) {
      const d = Number(v.id.slice('ncube-'.length));
      assert.deepEqual(v.derive(seed), deriveNcube(seed, d));
    }
  }
});

// ---------------------------------------------------------------- describe

test('describe: "<d>-cube (<name>), <finish>"', () => {
  assert.equal(describeNcube({ dimension: 4, finish: 2 }), '4-cube (tesseract), wireframe');
  assert.equal(describeNcube({ dimension: 3, finish: 0 }), '3-cube (cube), shaded');
  for (const seed of SEEDS) {
    for (const v of ncubeVariants) {
      const p = v.derive(seed);
      assert.equal(v.describe(p), `${p.dimension}-cube (${NCUBE_NAMES[p.dimension]}), ${FINISH_NAMES[p.finish]}`);
    }
  }
});

// ---------------------------------------------------------------- descriptors

test('family: ncubeVariants is frozen [ncube, ncube-3 … ncube-<MAX>] with labels and spec', () => {
  assert.ok(Object.isFrozen(ncubeVariants));
  assert.equal(ncubeVariants[0], ncube);
  assert.equal(ncube.id, 'ncube');
  assert.equal(ncube.label, 'N-cube');
  assert.equal(ncube.spec, NCUBE_SPEC_VERSION);
  const expectedIds = ['ncube', ...dimensions().map((d) => `ncube-${d}`)];
  assert.deepEqual(ncubeVariants.map((v) => v.id), expectedIds);
  for (const v of ncubeVariants.slice(1)) {
    const d = Number(v.id.slice('ncube-'.length));
    assert.equal(v.label, `${d}-cube (${NCUBE_NAMES[d]})`);
    assert.equal(v.spec, NCUBE_SPEC_VERSION);
    assert.ok(Object.isFrozen(v));
  }
});

// ---------------------------------------------------------------- static hooks

test('hooks: pose returns the same frozen rest orientation for every state', () => {
  for (const seed of SEEDS) {
    const p = deriveNcube(seed);
    const rest = poseNcube(p, 'idle');
    assert.ok(Object.isFrozen(rest));
    assert.deepEqual(rest, { ax: p.ax, ay: p.ay, az: p.az });
    for (const state of [...STATES, 'settling']) assert.deepEqual(poseNcube(p, state), rest);
  }
});

test('hooks: animate returns its input outside settling and ctx.rest inside it', () => {
  const p = deriveNcube('maya');
  const rest = poseNcube(p, 'idle');
  const pose = { ax: 1, ay: 2, az: 3 };
  for (const state of STATES) {
    if (state === 'idle') continue;
    const ctx = { params: p, state, dt: 0.033, t: 1, transientT: 0, rest };
    assert.equal(animateNcube(pose, ctx), pose, state);
  }
  assert.equal(animateNcube(pose, { params: p, state: 'idle', dt: 0.033, t: 1, transientT: 0, rest }), pose);
  assert.equal(animateNcube(pose, { params: p, state: 'settling', dt: 0.033, t: 1, transientT: 0, rest }), rest);
});

test('hooks: flash mirrors polyhedron', () => {
  const p = deriveNcube('maya');
  assert.deepEqual(flashNcube(p, 'receiving'), { hue: p.hue, lighten: 26 });
  assert.deepEqual(flashNcube(p, 'done'), { hue: 145 });
  assert.deepEqual(flashNcube(p, 'error'), { hue: 4, shake: true });
  for (const state of STATES) {
    if (['receiving', 'done', 'error'].includes(state)) continue;
    assert.equal(flashNcube(p, state), null, state);
  }
});

// ---------------------------------------------------------------- painting

test('paint: every finish renders for every dimension and honors effects', () => {
  for (const v of ncubeVariants) {
    for (const seed of SEEDS) {
      for (const finish of [0, 1, 2]) {
        const p = { ...v.derive(seed), finish };
        const prepared = v.prepare(p, { size: 64 });
        const geo = v.geometry(prepared);
        const pose = v.pose(prepared, 'idle');
        const light = v.paint(prepared, geo, pose, { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null });
        assert.match(light, /^<(path|g)/, `${v.id} ${seed} finish ${finish}`);
        const dark = v.paint(prepared, geo, pose, { dark: true, sleeping: false, dx: 0, lighten: 0, flash: null });
        assert.notEqual(dark, light, 'dark mode changes the ink');
        const shifted = v.paint(prepared, geo, pose, { dark: false, sleeping: false, dx: 3, lighten: 0, flash: null });
        assert.notEqual(shifted, light, 'dx shifts the projection');
        const flashed = v.paint(prepared, geo, pose, { dark: false, sleeping: false, dx: 0, lighten: 10, flash: { hue: 145, strength: 0.75 } });
        assert.notEqual(flashed, light, 'flash and lighten recolor');
        if (finish !== 2) {
          const sleeping = v.paint(prepared, geo, pose, { dark: false, sleeping: true, dx: 0, lighten: 0, flash: null });
          assert.notEqual(sleeping, light, 'sleeping flattens the shading ramp');
        }
      }
    }
  }
});

test('paint: prepare keeps identity fields and downgrades wireframe below size 28 like polyhedron', () => {
  const p = { ...deriveNcube('maya', 5), finish: 2 };
  const big = ncube.prepare(p, { size: 64 });
  const small = ncube.prepare(p, { size: 24 });
  assert.equal(big.finish, 2);
  assert.equal(small.finish, 0);
  for (const key of Object.keys(p)) {
    if (key === 'finish') continue;
    assert.deepEqual(big[key], p[key], key);
  }
  assert.ok(typeof big.strokeWidth === 'number' && big.strokeWidth >= 1 && big.strokeWidth <= 3.5);
  const thin = ncube.prepare({ ...deriveNcube('maya', NCUBE_MAX_DIMENSION), finish: 2 }, { size: 64 });
  const thick = ncube.prepare({ ...deriveNcube('maya', 3), finish: 2 }, { size: 64 });
  assert.ok(thin.strokeWidth <= thick.strokeWidth, 'stroke width does not grow with dimension');
});

test('render: static SVG stays inside the viewBox and names the dimension for every id and finish', () => {
  const { renderStaticSVG } = localRenderer();
  for (const v of ncubeVariants) {
    for (const seed of SEEDS) {
      const svg = renderStaticSVG(seed, { variant: v.id });
      const p = v.derive(seed);
      assert.match(svg, new RegExp(`aria-label="${seed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: ${p.dimension}-cube \\(${NCUBE_NAMES[p.dimension]}\\), ${FINISH_NAMES[p.finish]}, idle"`));
      const nums = pathNumbers(svg);
      assert.ok(nums.length > 0);
      for (const n of nums) assert.ok(n >= 0 && n <= 100, `${v.id} ${seed}: ${n} outside viewBox`);
    }
  }
  const tesseract = renderStaticSVG('maya', { variant: 'ncube-4' });
  assert.match(tesseract, /aria-label="maya: 4-cube \(tesseract\)/);
});

test('render: static markup equals the mounted markup at rest', async () => {
  const dom = installDom();
  const core = await import('../src/core.js?ncube-parity');
  const { renderStaticSVG, mountGlyph } = localRenderer(core);
  for (const v of ncubeVariants) {
    for (const seed of SEEDS.slice(0, 3)) {
      dom.scratch.innerHTML = renderStaticSVG(seed, { variant: v.id, dark: false });
      const staticInner = dom.scratch.querySelector('svg > g').innerHTML;
      const handle = mountGlyph(dom.container, seed, { variant: v.id, dark: false });
      assert.equal(handle.variant, v.id);
      assert.deepEqual(handle.params, v.prepare(v.derive(seed), { size: 64 }));
      const mountedInner = dom.container.querySelector('svg > g').innerHTML;
      assert.equal(mountedInner, staticInner, `${v.id} ${seed}`);
      handle.destroy();
    }
  }
});

test('render: working state never repaints a static n-cube across frames', async () => {
  const dom = installDom();
  const core = await import('../src/core.js?ncube-static-frames');
  const { mountGlyph } = localRenderer(core);
  const handle = mountGlyph(dom.container, 'maya', { variant: 'ncube', state: 'working' });
  const inner = () => dom.container.querySelector('svg > g').innerHTML;
  const initial = inner();
  let now = 1000;
  for (let i = 0; i < 6; i += 1, now += 33) dom.advanceAnimationFrame(now);
  assert.equal(inner(), initial);
  handle.destroy();
});

test('render: reduced motion mount queues no frames and keeps the rest markup through states', async () => {
  const dom = installDom({ reducedMotion: true });
  const core = await import('../src/core.js?ncube-reduced');
  const { renderStaticSVG, mountGlyph } = localRenderer(core);
  const handle = mountGlyph(dom.container, 'Ada Lovelace', { variant: 'ncube-4', state: 'working', dark: false });
  assert.equal(dom.animationFrames, 0);
  dom.scratch.innerHTML = renderStaticSVG('Ada Lovelace', { variant: 'ncube-4', dark: false });
  const staticInner = dom.scratch.querySelector('svg > g').innerHTML;
  const inner = () => dom.container.querySelector('svg > g').innerHTML;
  assert.equal(inner(), staticInner);
  for (const state of STATES) {
    handle.setState(state);
    if (state === 'sleeping') assert.notEqual(inner(), staticInner, 'sleeping repaints with the dimmer ramp');
    else assert.equal(inner(), staticInner, state);
    assert.equal(dom.animationFrames, 0);
  }
  handle.setState('idle');
  assert.equal(inner(), staticInner);
  handle.destroy();
});

test('render: setState through every STATES entry never throws and settles back to rest', async () => {
  const dom = installDom();
  const core = await import('../src/core.js?ncube-states');
  const { mountGlyph } = localRenderer(core);
  const handle = mountGlyph(dom.container, 'build-bot-7', { variant: 'ncube', state: 'working' });
  const inner = () => dom.container.querySelector('svg > g').innerHTML;
  const rest = inner();
  let now = 1000;
  for (const state of STATES) {
    assert.doesNotThrow(() => handle.setState(state), state);
    assert.equal(handle.state, state);
    for (let i = 0; i < 60; i += 1, now += 33) dom.advanceAnimationFrame(now);
  }
  assert.equal(inner(), rest, 'after every flash decays the glyph is back at its rest markup');
  handle.destroy();
});

// ---------------------------------------------------------------- registry

test('registry: built-ins are polyhedron (default) followed by the n-cube family in order', async () => {
  const { BUILT_IN_VARIANTS, DEFAULT_VARIANT_ID, listVariants, resolveVariant } = await import('../src/variants/index.js');
  assert.equal(DEFAULT_VARIANT_ID, 'polyhedron');
  assert.equal(BUILT_IN_VARIANTS.defaultId, 'polyhedron');
  assert.deepEqual(BUILT_IN_VARIANTS.ids, ['polyhedron', 'ncube', ...dimensions().map((d) => `ncube-${d}`)]);
  assert.deepEqual(resolveVariant('ncube'), ncube);
  assert.deepEqual(resolveVariant('ncube-4'), ncubeVariants[2]);
  assert.deepEqual(resolveVariant(), polyhedron);
  const info = listVariants();
  assert.deepEqual(info[0], { id: 'polyhedron', label: 'Polyhedron', spec: 'v1' });
  assert.deepEqual(info[1], { id: 'ncube', label: 'N-cube', spec: NCUBE_SPEC_VERSION });
  assert.deepEqual(info[2], { id: 'ncube-3', label: '3-cube (cube)', spec: NCUBE_SPEC_VERSION });
  assert.throws(() => resolveVariant(`ncube-${NCUBE_MAX_DIMENSION + 1}`), RangeError);
});

test('registry: public renderStaticSVG accepts every n-cube id', async () => {
  const { renderStaticSVG, listVariants } = await import('../src/index.js');
  const ids = listVariants().map((v) => v.id).filter((id) => id.startsWith('ncube'));
  assert.equal(ids.length, ncubeVariants.length);
  for (const id of ids) {
    assert.match(renderStaticSVG('maya', { variant: id }), /-cube \(/);
  }
  assert.match(renderStaticSVG('maya', { variant: 'ncube-4' }), /aria-label="maya: 4-cube \(tesseract\)/);
});
