import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
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
  dom.window.matchMedia = (query) => ({
    matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
    media: query
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IntersectionObserver = undefined;
  globalThis.requestAnimationFrame = () => {
    animationFrames += 1;
    return animationFrames;
  };
  return {
    container: dom.window.document.getElementById('glyph'),
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