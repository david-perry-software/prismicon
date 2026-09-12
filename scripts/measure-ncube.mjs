#!/usr/bin/env node
/**
 * Measure the practical upper bound for the n-cube family.
 *
 * For each candidate dimension d in 3..10 (geometry built directly, bypassing
 * the registry) and each finish, renders the five golden seeds as static SVG at
 * size 64 and reports vertex/edge/face counts, the largest SVG byte size, the
 * median projected edge length in viewBox units and the median paint() time
 * over 200 calls. The recommended NCUBE_MAX_DIMENSION is the largest d for
 * which every smaller-or-equal dimension passes all three criteria.
 *
 * A second table simulates the engine loop for every registered dimension and
 * finish (60 working frames at dt = 1/30, 12 sending frames, then settling until
 * animate returns ctx.rest) and reports median/p95 animate + paint ms and the
 * settling frame count, gated as `frame gate: pass|fail`.
 *
 * Not published (scripts/ is outside package.json "files").
 */

import { performance } from 'node:perf_hooks';
import { createRenderer } from '../src/core.js';
import { createVariantRegistry, defineVariant } from '../src/variants/registry.js';
import { FINISH_NAMES } from '../src/variants/polyhedron.js';
import { cyrb53, mulberry32 } from '../src/variants/seed.js';
import {
  NCUBE_MAX_DIMENSION,
  NCUBE_MIN_DIMENSION,
  NCUBE_NAMES,
  NCUBE_SPEC_VERSION,
  animateNcube,
  buildNcube,
  deriveNcube,
  describeNcube,
  flashNcube,
  paintNcube,
  poseNcube,
  prepareNcube
} from '../src/variants/ncube.js';

const SEEDS = ['maya', 'build-bot-7', 'Alice@X.com', 'Ada Lovelace', 'demo-agent'];
const DIMENSIONS = [3, 4, 5, 6, 7, 8, 9, 10];
const REGISTERED_DIMENSIONS = Array.from(
  { length: NCUBE_MAX_DIMENSION - NCUBE_MIN_DIMENSION + 1 },
  (_, i) => NCUBE_MIN_DIMENSION + i
);
const SIZE = 64;
const PAINT_CALLS = 200;
const MAX_BYTES = 32 * 1024;
const MIN_MEDIAN_EDGE = 2.5;
const MAX_MEDIAN_PAINT_MS = 5;
const TAU = Math.PI * 2;

/** ncube-v1 params extended with extra plane angles so dimensions above the current bound can be painted. */
function measuredParams(seed, dimension, finish) {
  const p = deriveNcube(seed);
  const extra = mulberry32(cyrb53(p.seed + '#measure'));
  const theta = Array.from({ length: Math.max(0, dimension - 3) }, (_, i) => p.theta[i] ?? extra() * TAU);
  return Object.freeze({ ...p, dimension, finish, theta: Object.freeze(theta) });
}

function measuredVariant(dimension, finish) {
  return defineVariant({
    id: `measure-${dimension}-${finish}`,
    label: `${dimension}-cube ${FINISH_NAMES[finish]}`,
    spec: NCUBE_SPEC_VERSION,
    derive: (seed) => measuredParams(seed, dimension, finish),
    describe: (p) => `${p.dimension}-cube (${NCUBE_NAMES[p.dimension] ?? 'n-cube'}), ${FINISH_NAMES[p.finish]}`,
    prepare: prepareNcube,
    geometry: (p) => buildNcube(p.dimension),
    pose: poseNcube,
    animate: animateNcube,
    paint: paintNcube,
    flash: flashNcube
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function edgeLengths(wireframeSvg) {
  const d = / d="([^"]*)"/.exec(wireframeSvg)[1];
  return [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+) (-?[\d.]+)/g)]
    .map(([, x1, y1, x2, y2]) => Math.hypot(Number(x2) - Number(x1), Number(y2) - Number(y1)));
}

const EFFECTS = { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null };

function measure(dimension) {
  const geo = buildNcube(dimension);
  const variants = [0, 1, 2].map((finish) => measuredVariant(dimension, finish));
  const { renderStaticSVG } = createRenderer(createVariantRegistry(variants, { defaultId: variants[0].id }));
  const rows = [];
  const lengths = [];
  for (const [finish, variant] of variants.entries()) {
    let maxBytes = 0;
    const prepared = SEEDS.map((seed) => {
      const svg = renderStaticSVG(seed, { variant: variant.id, size: SIZE });
      maxBytes = Math.max(maxBytes, Buffer.byteLength(svg, 'utf8'));
      if (finish === 2) lengths.push(...edgeLengths(svg));
      const p = prepareNcube(variant.derive(seed), { size: SIZE });
      return { p, pose: poseNcube(p) };
    });
    const times = [];
    for (let i = 0; i < PAINT_CALLS; i += 1) {
      const { p, pose } = prepared[i % prepared.length];
      const t0 = performance.now();
      paintNcube(p, geo, pose, EFFECTS);
      times.push(performance.now() - t0);
    }
    rows.push({ finish: FINISH_NAMES[finish], maxBytes, medianPaintMs: median(times) });
  }
  const medianEdge = median(lengths);
  const pass = rows.every((r) => r.maxBytes <= MAX_BYTES && r.medianPaintMs <= MAX_MEDIAN_PAINT_MS) && medianEdge >= MIN_MEDIAN_EDGE;
  return { dimension, vertices: geo.V.length, edges: geo.edges.length, faces: geo.faces.length, medianEdge, rows, pass };
}

const results = DIMENSIONS.map(measure);

console.log(`n-cube bound measurement — spec ${NCUBE_SPEC_VERSION}, size ${SIZE}, seeds: ${SEEDS.join(', ')}`);
console.log(`node ${process.version}, ${process.platform} ${process.arch}, ${new Date().toISOString().slice(0, 10)}`);
console.log(`criteria: max static SVG <= ${MAX_BYTES} bytes, median projected edge >= ${MIN_MEDIAN_EDGE} viewBox units, median paint() <= ${MAX_MEDIAN_PAINT_MS} ms over ${PAINT_CALLS} calls`);
console.log('');
console.log('| d  | vertices | edges | faces | finish    | max bytes | median edge | median paint ms | pass |');
console.log('|----|----------|-------|-------|-----------|-----------|-------------|-----------------|------|');
for (const r of results) {
  for (const row of r.rows) {
    const pass = row.maxBytes <= MAX_BYTES && row.medianPaintMs <= MAX_MEDIAN_PAINT_MS && r.medianEdge >= MIN_MEDIAN_EDGE;
    console.log(`| ${String(r.dimension).padEnd(2)} | ${String(r.vertices).padStart(8)} | ${String(r.edges).padStart(5)} | ${String(r.faces).padStart(5)} | ${row.finish.padEnd(9)} | ${String(row.maxBytes).padStart(9)} | ${r.medianEdge.toFixed(2).padStart(11)} | ${row.medianPaintMs.toFixed(3).padStart(15)} | ${pass ? 'yes ' : 'no  '} |`);
  }
}
console.log('');

let recommended = 0;
for (const r of results) {
  if (!r.pass) break;
  recommended = r.dimension;
}
console.log(`recommended NCUBE_MAX_DIMENSION=${recommended}`);

// ---------------------------------------------------------------- animated-frame benchmark (ncube-motion-system)

const FRAME_DT = 1 / 30;
const WORKING_FRAMES = 60;
const SENDING_FRAMES = 12;
const MAX_SETTLE_FRAMES = 60;
const MAX_MEDIAN_FRAME_MS = 2;
const MAX_P95_FRAME_MS = 4;

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}

/** Simulate the engine loop for one prepared glyph, timing animate + paint per frame. */
function simulateFrames(p, geo) {
  const rest = poseNcube(p, 'idle');
  const times = [];
  let pose = rest;
  let t = 0;
  let settleFrames = -1;
  const frame = (state, transientT) => {
    t += FRAME_DT;
    const t0 = performance.now();
    pose = animateNcube(pose, { params: p, state, dt: FRAME_DT, t, transientT, rest });
    paintNcube(p, geo, pose, EFFECTS);
    times.push(performance.now() - t0);
  };
  for (let i = 0; i < WORKING_FRAMES; i += 1) frame('working', 0);
  for (let i = 1; i <= SENDING_FRAMES; i += 1) frame('sending', i * FRAME_DT);
  for (let i = 1; i <= MAX_SETTLE_FRAMES + 1; i += 1) {
    frame('settling', 0);
    if (pose === rest) { settleFrames = i; break; }
  }
  return { times, settleFrames };
}

function measureFrames(dimension) {
  const geo = buildNcube(dimension);
  return [0, 1, 2].map((finish) => {
    const times = [];
    let settleFrames = 0;
    for (const seed of SEEDS) {
      const p = prepareNcube({ ...deriveNcube(seed, dimension), finish }, { size: SIZE });
      const run = simulateFrames(p, geo);
      times.push(...run.times);
      settleFrames = Math.max(settleFrames, run.settleFrames < 0 ? Infinity : run.settleFrames);
    }
    const medianMs = median(times);
    const p95Ms = percentile(times, 0.95);
    const pass = medianMs <= MAX_MEDIAN_FRAME_MS && p95Ms <= MAX_P95_FRAME_MS && settleFrames <= MAX_SETTLE_FRAMES;
    return { dimension, finish: FINISH_NAMES[finish], medianMs, p95Ms, settleFrames, pass };
  });
}

const frameRows = REGISTERED_DIMENSIONS.flatMap(measureFrames);

console.log('');
console.log(`n-cube animated-frame benchmark — registered dimensions ${NCUBE_MIN_DIMENSION}..${NCUBE_MAX_DIMENSION}, size ${SIZE}, dt ${FRAME_DT.toFixed(4)} s`);
console.log(`per seed: ${WORKING_FRAMES} working frames, ${SENDING_FRAMES} sending frames, then settling until animate returns ctx.rest`);
console.log(`criteria: median animate+paint <= ${MAX_MEDIAN_FRAME_MS} ms, p95 <= ${MAX_P95_FRAME_MS} ms, settling <= ${MAX_SETTLE_FRAMES} frames`);
console.log('');
console.log('| d  | finish    | median frame ms | p95 frame ms | settle frames | pass |');
console.log('|----|-----------|-----------------|--------------|---------------|------|');
for (const row of frameRows) {
  console.log(`| ${String(row.dimension).padEnd(2)} | ${row.finish.padEnd(9)} | ${row.medianMs.toFixed(3).padStart(15)} | ${row.p95Ms.toFixed(3).padStart(12)} | ${String(row.settleFrames).padStart(13)} | ${row.pass ? 'yes ' : 'no  '} |`);
}
console.log('');
console.log(`frame gate: ${frameRows.every((row) => row.pass) ? 'pass' : 'fail'}`);
