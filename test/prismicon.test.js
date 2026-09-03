import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

import { Prismicon } from '../src/react.js';
import { deriveV1, renderStaticSVG } from '../src/core.js';

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
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="glyph"></div></body></html>');
  let animationFrames = 0;
  const frameCallbacks = [];
  dom.window.matchMedia = (query) => ({
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
    media: query
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IntersectionObserver = undefined;
  globalThis.requestAnimationFrame = (callback) => {
    animationFrames += 1;
    frameCallbacks.push(callback);
    return animationFrames;
  };
  return {
    container: dom.window.document.getElementById('glyph'),
    advanceAnimationFrame(now) {
      const callback = frameCallbacks.shift();
      assert.ok(callback, 'expected a queued animation frame');
      callback(now);
    },
    get animationFrames() {
      return animationFrames;
    }
  };
}

test('derives deterministic normalized identities that distinguish names', () => {
  assert.deepEqual(deriveV1(' Ada Lovelace '), deriveV1('ada lovelace'));
  assert.notDeepEqual(deriveV1('Ada Lovelace'), deriveV1('Grace Hopper'));
});

test('server-renders accessible React SVG markup with identity and state', () => {
  const markup = renderToStaticMarkup(createElement(Prismicon, {
    seed: 'Ada Lovelace',
    size: 34,
    state: 'working',
    dark: true
  }));

  assert.match(markup, /<span[^>]*><svg/);
  assert.match(markup, /width="34" height="34" role="img"/);
  assert.match(markup, /aria-label="Ada Lovelace: [^"]+, working"/);
});

test('renders stable identity geometry with distinct dark shading', () => {
  const light = renderStaticSVG('Ada Lovelace', { dark: false });
  const dark = renderStaticSVG('Ada Lovelace', { dark: true });

  assert.notEqual(light, dark);
  assert.equal(deriveV1('Ada Lovelace').hash, deriveV1('Ada Lovelace').hash);
  assert.match(light, /aria-label="Ada Lovelace: [^"]+, idle"/);
  assert.match(dark, /aria-label="Ada Lovelace: [^"]+, idle"/);
});

test('updates lifecycle semantics and status ring patterns, then cleans up', async () => {
  const dom = installDom();
  const { mountGlyph } = await import('../src/core.js?motion-test');
  const handle = mountGlyph(dom.container, 'Ada Lovelace', { state: 'working' });
  const svg = dom.container.querySelector('svg');

  assert.equal(handle.state, 'working');
  assert.match(svg.getAttribute('aria-label'), /Ada Lovelace: .+, working$/);
  assert.ok(dom.animationFrames > 0);

  handle.setState('waiting');
  assert.equal(handle.state, 'waiting');
  assert.match(svg.getAttribute('aria-label'), /, waiting$/);
  assert.equal(svg.querySelector('circle').getAttribute('stroke-dasharray'), '0.1 9');

  handle.setState('done');
  assert.equal(handle.state, 'done');
  assert.match(svg.getAttribute('aria-label'), /, done$/);
  assert.equal(svg.querySelector('circle').hasAttribute('stroke-dasharray'), false);

  handle.setState('error');
  assert.match(svg.getAttribute('aria-label'), /, error$/);
  assert.equal(svg.querySelector('circle').getAttribute('stroke-dasharray'), '7 5');

  handle.destroy();
  assert.equal(dom.container.childElementCount, 0);
  assert.equal(dom.container.classList.contains('prismicon'), false);
});

test('React state updates keep the mounted SVG live so working geometry rotates', async () => {
  const dom = installDom();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(dom.container);
  await act(() => root.render(createElement(Prismicon, { seed: 'Ada Lovelace', state: 'idle' })));
  const mountedSvg = dom.container.querySelector('svg');

  await act(() => root.render(createElement(Prismicon, { seed: 'Ada Lovelace', state: 'working' })));
  assert.equal(dom.container.querySelector('svg'), mountedSvg, 'state updates must not replace the mounted SVG');

  const geometry = () => dom.container.querySelector('svg > g').innerHTML;
  const initial = geometry();
  dom.advanceAnimationFrame(1000);
  const firstFrame = geometry();
  dom.advanceAnimationFrame(1040);
  const secondFrame = geometry();

  assert.notEqual(firstFrame, initial);
  assert.notEqual(secondFrame, firstFrame);
  await act(() => root.unmount());
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

test('reduced motion stays static while preserving lifecycle semantics', async () => {
  const dom = installDom({ reducedMotion: true });
  const { mountGlyph } = await import('../src/core.js?reduced-motion-test');
  const handle = mountGlyph(dom.container, 'Grace Hopper', { state: 'working' });

  assert.equal(dom.animationFrames, 0);
  assert.equal(handle.state, 'working');

  handle.setState('waiting');
  const svg = dom.container.querySelector('svg');
  assert.match(svg.getAttribute('aria-label'), /Grace Hopper: .+, waiting$/);
  assert.equal(svg.querySelector('circle').getAttribute('stroke-dasharray'), '0.1 9');

  handle.destroy();
});

test('thinking and sleeping animate geometry while reporting their state', async () => {
  const dom = installDom();
  const { mountGlyph } = await import('../src/core.js?think-sleep-test');
  const handle = mountGlyph(dom.container, 'Ada Lovelace', { state: 'idle' });
  const svg = dom.container.querySelector('svg');
  const geometry = () => svg.querySelector('g').innerHTML;

  handle.setState('thinking');
  assert.equal(handle.state, 'thinking');
  assert.match(svg.getAttribute('aria-label'), /, thinking$/);
  dom.advanceAnimationFrame(1000);
  const thinkA = geometry();
  dom.advanceAnimationFrame(1033);
  const thinkB = geometry();
  assert.notEqual(thinkB, thinkA, 'thinking geometry must change between frames');

  handle.setState('sleeping');
  assert.equal(handle.state, 'sleeping');
  assert.match(svg.getAttribute('aria-label'), /, sleeping$/);
  dom.advanceAnimationFrame(1100);
  const sleepA = geometry();
  dom.advanceAnimationFrame(1133);
  const sleepB = geometry();
  assert.notEqual(sleepB, sleepA, 'sleeping geometry must change between frames');
  assert.equal(svg.querySelector('g').getAttribute('opacity'), '0.7', 'sleeping dims the glyph group');

  handle.destroy();
});

function advanceFrames(dom, startMs, count, stepMs) {
  for (let i = 0; i < count; i += 1) {
    dom.advanceAnimationFrame(startMs + (i + 1) * stepMs);
  }
}

test('sending and receiving settle back to idle while keeping their public state', async () => {
  const dom = installDom();
  const { mountGlyph } = await import('../src/core.js?send-recv-test');
  const handle = mountGlyph(dom.container, 'Ada Lovelace', { state: 'idle' });
  const svg = dom.container.querySelector('svg');
  const geometry = () => svg.querySelector('g').innerHTML;

  handle.setState('sending');
  assert.equal(handle.state, 'sending');
  assert.match(svg.getAttribute('aria-label'), /, sending$/);
  advanceFrames(dom, 1000, 70, 33);
  assert.equal(handle.state, 'sending', 'public state stays sticky after settling');
  const sentA = geometry();
  dom.advanceAnimationFrame(1000 + 71 * 33);
  const sentB = geometry();
  assert.equal(sentB, sentA, 'sending must settle to a static portrait');

  handle.setState('receiving');
  assert.equal(handle.state, 'receiving');
  assert.match(svg.getAttribute('aria-label'), /, receiving$/);
  advanceFrames(dom, 4000, 70, 33);
  assert.equal(handle.state, 'receiving', 'public state stays sticky after settling');
  const recvA = geometry();
  dom.advanceAnimationFrame(4000 + 71 * 33);
  const recvB = geometry();
  assert.equal(recvB, recvA, 'receiving must settle to a static portrait');

  handle.destroy();
});

test('new states render their ring or ripple treatment and aria-label', async () => {
  const dom = installDom();
  const { mountGlyph } = await import('../src/core.js?ring-ripple-test');
  const handle = mountGlyph(dom.container, 'Ada Lovelace', { state: 'idle' });
  const svg = dom.container.querySelector('svg');
  const statusGroup = () => svg.querySelectorAll('g')[1];

  handle.setState('thinking');
  assert.match(svg.getAttribute('aria-label'), /, thinking$/);
  assert.equal(statusGroup().querySelector('circle').getAttribute('stroke-dasharray'), '12 7');

  handle.setState('sending');
  assert.match(svg.getAttribute('aria-label'), /, sending$/);
  assert.match(statusGroup().querySelector('circle').getAttribute('style'), /animation:prismicon-ripple-out/);

  handle.setState('receiving');
  assert.match(svg.getAttribute('aria-label'), /, receiving$/);
  assert.match(statusGroup().querySelector('circle').getAttribute('style'), /animation:prismicon-ripple-in/);

  handle.setState('sleeping');
  assert.match(svg.getAttribute('aria-label'), /, sleeping$/);
  assert.equal(statusGroup().querySelector('circle'), null, 'sleeping has no ring');

  handle.destroy();
});