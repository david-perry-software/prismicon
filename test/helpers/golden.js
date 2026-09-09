import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

import { mountGlyph, renderStaticSVG } from '../../src/core.js';

const STATIC_SEEDS = ['maya', 'build-bot-7', 'Alice@X.com', 'Ada Lovelace', 'demo-agent'];
const STATIC_OPTS = [
  {},
  { size: 24 },
  { kind: 'user' },
  { state: 'thinking', dark: true },
  { state: 'waiting' },
  { state: 'error', size: 140 }
];

const MOUNTED_SCENARIOS = [
  { seed: 'maya', opts: {} },
  { seed: 'build-bot-7', opts: {} },
  { seed: 'maya', opts: { size: 24 } },
  { seed: 'build-bot-7', opts: { dark: true } }
];

const MOUNTED_STATES = ['waiting', 'thinking', 'sleeping', 'sending', 'receiving', 'done', 'error', 'idle'];
const WORKING_FRAMES = 10;
const PER_STATE_FRAMES = 4;
const FRAME_STEP = 33;

function installDom({ reducedMotion = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="glyph"></div></body></html>');
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
    advanceAnimationFrame(now) {
      const callback = frameCallbacks.shift();
      assert.ok(callback, 'expected a queued animation frame');
      callback(now);
    },
    animationFrames() {
      return frameCallbacks.length;
    },
    drainIfNeeded(now) {
      if (frameCallbacks.length > 0) this.advanceAnimationFrame(now);
    }
  };
}

function keyFor(seed, opts) {
  return `${seed}|${JSON.stringify(opts)}`;
}

function hashSvg(svg) {
  return createHash('sha256').update(svg.outerHTML, 'utf8').digest('hex');
}

function captureStatic() {
  const out = {};
  for (const seed of STATIC_SEEDS) {
    for (const opts of STATIC_OPTS) {
      out[keyFor(seed, opts)] = renderStaticSVG(seed, opts);
    }
  }
  return out;
}

async function captureMountedScenario(seed, opts) {
  const dom = installDom();
  const { mountGlyph } = await import('../../src/core.js?golden-' + keyFor(seed, opts));
  const handle = mountGlyph(dom.container, seed, { state: 'working', ...opts });
  const svg = dom.container.querySelector('svg');
  const frames = [];
  let t = 1000;

  for (let i = 0; i < WORKING_FRAMES; i += 1) {
    dom.advanceAnimationFrame(t);
    frames.push({ state: 'working', t, hash: hashSvg(svg) });
    t += FRAME_STEP;
  }

  for (const state of MOUNTED_STATES) {
    handle.setState(state);
    for (let i = 0; i < PER_STATE_FRAMES; i += 1) {
      dom.advanceAnimationFrame(t);
      frames.push({ state, t, hash: hashSvg(svg) });
      t += FRAME_STEP;
    }
  }

  handle.destroy();
  dom.drainIfNeeded(t);
  return frames;
}

async function captureReducedMotion(seed = 'Ada Lovelace') {
  const dom = installDom({ reducedMotion: true });
  const { mountGlyph } = await import('../../src/core.js?golden-reduced-' + seed);
  const handle = mountGlyph(dom.container, seed, { state: 'working' });
  const svg = dom.container.querySelector('svg');
  const states = ['working', 'waiting', 'thinking', 'sleeping', 'sending', 'receiving', 'done', 'error', 'idle'];
  const frames = [];

  for (const state of states) {
    if (state !== 'working') handle.setState(state);
    frames.push({ state, hash: hashSvg(svg) });
  }

  handle.destroy();
  return frames;
}

export async function captureGolden() {
  const staticFixtures = captureStatic();
  const mountedFixtures = {};
  for (const { seed, opts } of MOUNTED_SCENARIOS) {
    mountedFixtures[keyFor(seed, opts)] = await captureMountedScenario(seed, opts);
  }
  mountedFixtures[`Ada Lovelace|reduced`] = await captureReducedMotion('Ada Lovelace');
  return { static: staticFixtures, mounted: mountedFixtures };
}
