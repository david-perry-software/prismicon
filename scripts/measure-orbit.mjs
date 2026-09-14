#!/usr/bin/env node
/**
 * Measure the orbit variant's static and animated cost.
 *
 * Static table: the five golden seeds at size 64 — SVG bytes, ring/node counts
 * and the median paint() time over 200 calls, gated at <= 32768 bytes and
 * <= 5 ms median (`static gate: pass|fail`).
 *
 * Frame table: simulates the engine loop per seed (60 working frames at
 * dt = 1/30, 12 sending frames, then settling until animate returns ctx.rest)
 * and reports median/p95 animate + paint ms and the settling frame count,
 * gated at median <= 2 ms, p95 <= 4 ms, settling <= 60 frames
 * (`frame gate: pass|fail`).
 *
 * Exits nonzero when either gate fails.
 * Not published (scripts/ is outside package.json "files").
 */

import { performance } from 'node:perf_hooks';
import { createRenderer } from '../src/core.js';
import { createVariantRegistry } from '../src/variants/registry.js';
import {
  ORBIT_SPEC_VERSION,
  orbit,
  animateOrbit,
  buildOrbit,
  deriveOrbit,
  paintOrbit,
  poseOrbit,
  prepareOrbit
} from '../src/variants/orbit.js';

const SEEDS = ['maya', 'build-bot-7', 'Alice@X.com', 'Ada Lovelace', 'demo-agent'];
const SIZE = 64;
const PAINT_CALLS = 200;
const MAX_BYTES = 32 * 1024;
const MAX_MEDIAN_PAINT_MS = 5;

const FRAME_DT = 1 / 30;
const WORKING_FRAMES = 60;
const SENDING_FRAMES = 12;
const MAX_SETTLE_FRAMES = 60;
const MAX_MEDIAN_FRAME_MS = 2;
const MAX_P95_FRAME_MS = 4;

const EFFECTS = { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null };

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}

// ---------------------------------------------------------------- static table

const { renderStaticSVG } = createRenderer(createVariantRegistry([orbit], { defaultId: 'orbit' }));

const staticRows = SEEDS.map((seed) => {
  const svg = renderStaticSVG(seed, { variant: 'orbit', size: SIZE });
  const bytes = Buffer.byteLength(svg, 'utf8');
  const derived = deriveOrbit(seed);
  const nodes = derived.nodeCounts.slice(0, derived.ringCount).reduce((sum, n) => sum + n, 0);
  const p = prepareOrbit(derived, { size: SIZE });
  const geo = buildOrbit(p);
  const pose = poseOrbit(p, 'idle');
  const times = [];
  for (let i = 0; i < PAINT_CALLS; i += 1) {
    const t0 = performance.now();
    paintOrbit(p, geo, pose, EFFECTS);
    times.push(performance.now() - t0);
  }
  const medianPaintMs = median(times);
  const pass = bytes <= MAX_BYTES && medianPaintMs <= MAX_MEDIAN_PAINT_MS;
  return { seed, rings: derived.ringCount, nodes, bytes, medianPaintMs, pass };
});

console.log(`orbit static benchmark — spec ${ORBIT_SPEC_VERSION}, size ${SIZE}, seeds: ${SEEDS.join(', ')}`);
console.log(`node ${process.version}, ${process.platform} ${process.arch}, ${new Date().toISOString().slice(0, 10)}`);
console.log(`criteria: static SVG <= ${MAX_BYTES} bytes, median paint() <= ${MAX_MEDIAN_PAINT_MS} ms over ${PAINT_CALLS} calls`);
console.log('');
console.log('| seed        | rings | nodes | bytes | median paint ms | pass |');
console.log('|-------------|-------|-------|-------|-----------------|------|');
for (const r of staticRows) {
  console.log(`| ${r.seed.padEnd(11)} | ${String(r.rings).padStart(5)} | ${String(r.nodes).padStart(5)} | ${String(r.bytes).padStart(5)} | ${r.medianPaintMs.toFixed(3).padStart(15)} | ${r.pass ? 'yes ' : 'no  '} |`);
}
console.log('');
const staticPass = staticRows.every((r) => r.pass);
console.log(`static gate: ${staticPass ? 'pass' : 'fail'}`);

// ---------------------------------------------------------------- frame table

/** Simulate the engine loop for one prepared glyph, timing animate + paint per frame. */
function simulateFrames(p, geo) {
  const rest = poseOrbit(p, 'idle');
  const times = [];
  let pose = rest;
  let t = 0;
  let settleFrames = -1;
  const frame = (state, transientT) => {
    t += FRAME_DT;
    const t0 = performance.now();
    pose = animateOrbit(pose, { params: p, state, dt: FRAME_DT, t, transientT, rest });
    paintOrbit(p, geo, pose, EFFECTS);
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

const frameRows = SEEDS.map((seed) => {
  const p = prepareOrbit(deriveOrbit(seed), { size: SIZE });
  const geo = buildOrbit(p);
  const run = simulateFrames(p, geo);
  const medianMs = median(run.times);
  const p95Ms = percentile(run.times, 0.95);
  const settleFrames = run.settleFrames < 0 ? Infinity : run.settleFrames;
  const pass = medianMs <= MAX_MEDIAN_FRAME_MS && p95Ms <= MAX_P95_FRAME_MS && settleFrames <= MAX_SETTLE_FRAMES;
  return { seed, medianMs, p95Ms, settleFrames, pass };
});

console.log('');
console.log(`orbit animated-frame benchmark — size ${SIZE}, dt ${FRAME_DT.toFixed(4)} s`);
console.log(`per seed: ${WORKING_FRAMES} working frames, ${SENDING_FRAMES} sending frames, then settling until animate returns ctx.rest`);
console.log(`criteria: median animate+paint <= ${MAX_MEDIAN_FRAME_MS} ms, p95 <= ${MAX_P95_FRAME_MS} ms, settling <= ${MAX_SETTLE_FRAMES} frames`);
console.log('');
console.log('| seed        | median frame ms | p95 frame ms | settle frames | pass |');
console.log('|-------------|-----------------|--------------|---------------|------|');
for (const row of frameRows) {
  console.log(`| ${row.seed.padEnd(11)} | ${row.medianMs.toFixed(3).padStart(15)} | ${row.p95Ms.toFixed(3).padStart(12)} | ${String(row.settleFrames).padStart(13)} | ${row.pass ? 'yes ' : 'no  '} |`);
}
console.log('');
const framePass = frameRows.every((row) => row.pass);
console.log(`frame gate: ${framePass ? 'pass' : 'fail'}`);

if (!staticPass || !framePass) process.exitCode = 1;
