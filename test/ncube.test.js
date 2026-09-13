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
    assert.deepEqual(rest, { ax: p.ax, ay: p.ay, az: p.az, theta: p.theta });
    assert.equal(rest.theta, p.theta, 'rest pose carries the params theta array by identity');
    for (const state of [...STATES, 'settling']) {
      const pose = poseNcube(p, state);
      assert.deepEqual(pose, rest, state);
      assert.equal(pose.theta, p.theta, state);
    }
  }
});

test('hooks: animate returns its input for idle/done/error and ctx.rest once settled', () => {
  const p = ncube.prepare(deriveNcube('maya'), { size: 64 });
  const rest = poseNcube(p, 'idle');
  const pose = Object.freeze({ ax: 1, ay: 2, az: 3, theta: Object.freeze([0.5, 1.5, 2.5]) });
  for (const state of ['idle', 'done', 'error']) {
    assert.equal(animateNcube(pose, { params: p, state, dt: 0.033, t: 1, transientT: 0, rest }), pose, state);
  }
  assert.equal(animateNcube(rest, { params: p, state: 'settling', dt: 0.033, t: 1, transientT: 0, rest }), rest);
});

function preparedFor(seed, d) {
  return ncube.prepare(deriveNcube(seed, d), { size: 64 });
}

function runFrames(p, pose, state, frames, dt = 1 / 30) {
  const rest = poseNcube(p, 'idle');
  const out = [pose];
  for (let i = 0; i < frames; i += 1) {
    pose = animateNcube(pose, { params: p, state, dt, t: (i + 1) * dt, transientT: (i + 1) * dt, rest });
    out.push(pose);
  }
  return out;
}

function wrapDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

test('hooks: working advances theta[d-4] by dir·hyperSpeed·dt and leaves higher planes at rest', () => {
  const dt = 1 / 30;
  for (const seed of SEEDS) {
    for (const d of dimensions()) {
      if (d < 4) continue;
      const p = preparedFor(seed, d);
      const top = d - 4;
      const frames = runFrames(p, poseNcube(p, 'idle'), 'working', 12, dt);
      for (let i = 1; i < frames.length; i += 1) {
        const prev = frames[i - 1], next = frames[i];
        assert.notEqual(next, prev, 'each working frame is a new object');
        assert.ok(Object.isFrozen(next) && Object.isFrozen(next.theta), 'frames are frozen');
        assert.ok(Math.abs(wrapDiff(next.theta[top], prev.theta[top]) - p.dir * p.hyperSpeed * dt) < 1e-9, `${seed} d=${d} top plane step`);
        for (let j = top + 1; j < next.theta.length; j += 1) assert.equal(next.theta[j], p.theta[j], `${seed} d=${d} theta[${j}] at rest`);
        for (let j = 0; j < top; j += 1) {
          const expected = p.dir * p.hyperSpeed * 0.4 ** (top - j) * dt;
          assert.ok(Math.abs(wrapDiff(next.theta[j], prev.theta[j]) - expected) < 1e-9, `${seed} d=${d} cascade theta[${j}]`);
        }
        assert.ok(Math.abs(wrapDiff(next[p.spinAxis], prev[p.spinAxis]) - p.spin3 * dt) < 1e-9, 'spin axis drifts at spin3');
      }
    }
  }
});

test('hooks: a working cube never changes theta and spins only on spinAxis', () => {
  for (const seed of SEEDS) {
    const p = preparedFor(seed, 3);
    const rest = poseNcube(p, 'idle');
    const frames = runFrames(p, rest, 'working', 30);
    for (let i = 1; i < frames.length; i += 1) {
      assert.deepEqual(frames[i].theta, p.theta, 'theta unchanged');
      for (const axis of ['ax', 'ay', 'az']) {
        if (axis === p.spinAxis) assert.ok(Math.abs(wrapDiff(frames[i][axis], frames[i - 1][axis]) - p.spin3 / 30) < 1e-9, axis);
        else assert.ok(Math.abs(wrapDiff(frames[i][axis], rest[axis])) < 1e-9, `${axis} stays at rest`);
      }
    }
  }
});

test('hooks: 60 working frames keep every coordinate inside the viewBox for every id and finish', () => {
  for (const v of ncubeVariants) {
    for (const seed of SEEDS) {
      for (const finish of [0, 1, 2]) {
        const p = v.prepare({ ...v.derive(seed), finish }, { size: 64 });
        const geo = v.geometry(p);
        const frames = runFrames(p, v.pose(p, 'working'), 'working', 60);
        for (const pose of frames) {
          const nums = pathNumbers(v.paint(p, geo, pose, { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null }));
          assert.ok(nums.length > 0);
          for (const n of nums) assert.ok(n >= 0 && n <= 100, `${v.id} ${seed} finish ${finish}: ${n} outside viewBox`);
        }
      }
    }
  }
});

test('hooks: animate never mutates its frozen input', () => {
  for (const d of dimensions()) {
    const p = preparedFor('maya', d);
    const rest = poseNcube(p, 'idle');
    const input = Object.freeze({ ax: 0.3, ay: 0.6, az: 0.9, theta: Object.freeze([0.1, 0.2, 0.3]) });
    const snapshot = JSON.parse(JSON.stringify(input));
    for (const state of [...STATES, 'settling']) {
      animateNcube(input, { params: p, state, dt: 1 / 30, t: 0.5, transientT: 0.1, rest });
      assert.deepEqual(JSON.parse(JSON.stringify(input)), snapshot, `${state} d=${d}`);
    }
  }
});

test('hooks: waiting, thinking, sleeping, sending and receiving move on the first frame and stay near rest', () => {
  const dt = 1 / 30;
  for (const seed of SEEDS) {
    for (const d of dimensions()) {
      const p = preparedFor(seed, d);
      const rest = poseNcube(p, 'idle');
      for (const state of ['waiting', 'thinking', 'sleeping', 'sending', 'receiving']) {
        const first = animateNcube(rest, { params: p, state, dt, t: 0, transientT: dt, rest });
        assert.notEqual(first, rest, `${seed} d=${d} ${state} returns a new object`);
        assert.ok(Object.isFrozen(first) && Object.isFrozen(first.theta), 'frames are frozen');
        assert.notDeepEqual(first, rest, `${seed} d=${d} ${state} differs from rest on the first frame`);
        if (state === 'sending' || state === 'receiving') continue;
        const frames = runFrames(p, rest, state, 60, dt);
        const last = frames[frames.length - 1];
        for (const axis of ['ax', 'ay', 'az']) assert.ok(Math.abs(wrapDiff(last[axis], rest[axis])) < 0.2, `${seed} d=${d} ${state} ${axis} bounded`);
        last.theta.forEach((th, i) => assert.ok(Math.abs(wrapDiff(th, rest.theta[i])) < 0.2, `${seed} d=${d} ${state} theta[${i}] bounded`));
      }
    }
  }
});

test('hooks: sending and receiving burst in opposite directions on the highest plane (or the cube spin axis)', () => {
  const dt = 1 / 30;
  for (const seed of SEEDS) {
    for (const d of dimensions()) {
      const p = preparedFor(seed, d);
      const rest = poseNcube(p, 'idle');
      const top = d - 4;
      const read = (pose) => (top >= 0 ? pose.theta[top] : pose[p.spinAxis]);
      const sending = animateNcube(rest, { params: p, state: 'sending', dt, t: 0, transientT: dt, rest });
      const receiving = animateNcube(rest, { params: p, state: 'receiving', dt, t: 0, transientT: dt, rest });
      const ds = wrapDiff(read(sending), read(rest));
      const dr = wrapDiff(read(receiving), read(rest));
      assert.ok(ds !== 0 && Math.sign(ds) === -Math.sign(dr), `${seed} d=${d} opposite bursts (${ds}, ${dr})`);
      assert.ok(Math.abs(Math.abs(ds) - Math.abs(dr)) < 1e-12, 'symmetric magnitude');
      if (top >= 0) {
        rest.theta.forEach((th, i) => { if (i !== top) assert.equal(sending.theta[i], th, `theta[${i}] untouched by the burst`); });
      } else {
        assert.equal(sending.theta, rest.theta, 'a cube burst never touches theta');
      }
      const late = animateNcube(rest, { params: p, state: 'sending', dt, t: 0.4, transientT: 0.4, rest });
      assert.ok(Math.abs(wrapDiff(read(late), read(rest))) < Math.abs(ds), 'the burst decays over transientT');
    }
  }
});

test('hooks: settling eases every angle to rest and returns ctx.rest by identity within 60 frames', () => {
  for (const seed of SEEDS) {
    for (const d of dimensions()) {
      const p = preparedFor(seed, d);
      const rest = poseNcube(p, 'idle');
      let pose = Object.freeze({ ax: rest.ax + 1, ay: rest.ay - 1, az: rest.az + 1, theta: Object.freeze(rest.theta.map((th) => th + 1)) });
      let settledAt = -1;
      for (let i = 1; i <= 60; i += 1) {
        const next = animateNcube(pose, { params: p, state: 'settling', dt: 1 / 30, t: i / 30, transientT: 0, rest });
        if (next === rest) { settledAt = i; break; }
        assert.notEqual(next, pose, 'each settling frame is a new object');
        for (const axis of ['ax', 'ay', 'az']) assert.ok(Math.abs(wrapDiff(next[axis], rest[axis])) < Math.abs(wrapDiff(pose[axis], rest[axis])), `${axis} converges`);
        pose = next;
      }
      assert.ok(settledAt > 0 && settledAt <= 60, `${seed} d=${d} settled at frame ${settledAt}`);
    }
  }
});

test('hooks: validateVariant passes for ncube and every ncube-<d>', async () => {
  const { validateVariant } = await import('../src/variants/validate.js');
  for (const v of ncubeVariants) {
    let validated;
    assert.doesNotThrow(() => { validated = validateVariant(v); }, v.id);
    assert.equal(validated.id, v.id);
  }
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

test('prepare: motion traits are deterministic, within the documented ranges and spread across seeds', () => {
  const dirs = new Set();
  const axes = new Set();
  for (const seed of SEEDS) {
    for (const d of dimensions()) {
      const p = deriveNcube(seed, d);
      const a = ncube.prepare(p, { size: 64 });
      const b = ncube.prepare(p, { size: 140 });
      for (const key of ['dir', 'hyperSpeed', 'spinAxis', 'spin3', 'phase', 'phase2']) {
        assert.deepEqual(a[key], b[key], `${seed} d=${d} ${key} deterministic across sizes`);
      }
      assert.ok(a.dir === 1 || a.dir === -1, 'dir is ±1');
      assert.ok(['ax', 'ay', 'az'].includes(a.spinAxis), 'spinAxis names a 3D angle');
      assert.equal(a.phase, p.ax, 'phase reuses ax');
      assert.equal(a.phase2, p.ay, 'phase2 reuses ay');
      if (d === 3) {
        assert.equal(a.hyperSpeed, 0, 'a cube has no hyper plane');
        assert.ok(Math.abs(a.spin3) >= 0.45 && Math.abs(a.spin3) <= 0.85, `cube spin3 ${a.spin3}`);
      } else {
        const damp = 1 + 0.25 * (d - 4);
        assert.ok(a.hyperSpeed >= 0.55 / damp - 1e-12 && a.hyperSpeed <= 0.9 / damp + 1e-12, `d=${d} hyperSpeed ${a.hyperSpeed}`);
        assert.equal(Math.abs(a.spin3), 0.22, 'hyper-rotating cubes drift slowly in 3D');
      }
      assert.equal(Math.sign(a.spin3), a.dir, 'spin3 follows dir');
      for (const key of Object.keys(p)) {
        if (key === 'finish') continue;
        assert.deepEqual(a[key], p[key], `identity field ${key} unchanged`);
      }
      if (d === p.dimension) { dirs.add(a.dir); axes.add(a.spinAxis); }
    }
  }
  assert.ok(dirs.size > 1, 'golden seeds do not all share dir');
  assert.ok(axes.size > 1, 'golden seeds do not all share spinAxis');
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

test('render: working repaints across frames and returns to the exact rest markup after idle', async () => {
  const dom = installDom();
  const core = await import('../src/core.js?ncube-working-frames');
  const { renderStaticSVG, mountGlyph } = localRenderer(core);
  dom.scratch.innerHTML = renderStaticSVG('maya', { variant: 'ncube-4', dark: false });
  const staticInner = dom.scratch.querySelector('svg > g').innerHTML;
  const handle = mountGlyph(dom.container, 'maya', { variant: 'ncube-4', state: 'working', dark: false });
  const inner = () => dom.container.querySelector('svg > g').innerHTML;
  assert.equal(inner(), staticInner, 'first working frame equals the static portrait');
  let now = 1000;
  const seen = new Set([staticInner]);
  for (let i = 0; i < 6; i += 1, now += 33) {
    dom.advanceAnimationFrame(now);
    seen.add(inner());
  }
  assert.ok(seen.size > 3, 'working repaints across frames');
  handle.setState('idle');
  for (let i = 0; i < 90; i += 1, now += 33) dom.advanceAnimationFrame(now);
  assert.equal(inner(), staticInner, 'settling returns to the exact rest markup');
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
  assert.notEqual(inner(), rest, 'sleeping (the last STATES entry) bobs and paints the dimmer ramp');
  handle.setState('idle');
  for (let i = 0; i < 60; i += 1, now += 33) dom.advanceAnimationFrame(now);
  assert.equal(inner(), rest, 'after every flash decays and settling completes the glyph is back at its rest markup');
  handle.destroy();
});

// ---------------------------------------------------------------- registry

test('registry: built-ins are polyhedron (default) followed by the n-cube family in order', async () => {
  const { BUILT_IN_VARIANTS, DEFAULT_VARIANT_ID, listVariants, resolveVariant } = await import('../src/variants/index.js');
  assert.equal(DEFAULT_VARIANT_ID, 'polyhedron');
  assert.equal(BUILT_IN_VARIANTS.defaultId, 'polyhedron');
  assert.deepEqual(BUILT_IN_VARIANTS.ids, ['polyhedron', 'ncube', ...dimensions().map((d) => `ncube-${d}`), 'orbit']);
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
