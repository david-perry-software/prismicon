import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createRenderer } from '../src/core.js';
import { createVariantRegistry } from '../src/variants/registry.js';
import { polyhedron } from '../src/variants/polyhedron.js';
import { square } from './fixtures/square-variant.js';

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
    get animationFrames() {
      return frameCallbacks.length;
    }
  };
}

function createTestRenderer() {
  return createRenderer(createVariantRegistry([polyhedron, square], { defaultId: 'polyhedron' }));
}

describe('renderer dispatch', () => {
  test('static square renders a rect plus ring and aria-label for an agent', () => {
    const { renderStaticSVG } = createTestRenderer();
    const svg = renderStaticSVG('Ada Lovelace', { variant: 'square', state: 'waiting' });
    assert.match(svg, /<rect/);
    assert.match(svg, /stroke-dasharray="0\.1 9"/);
    assert.match(svg, /aria-label="Ada Lovelace: square ada lovelace, waiting"/);
  });

  test('kind user has no ring and no state suffix', () => {
    const { renderStaticSVG } = createTestRenderer();
    const svg = renderStaticSVG('Ada Lovelace', { variant: 'square', kind: 'user' });
    assert.match(svg, /<rect/);
    assert.doesNotMatch(svg, /stroke-dasharray/);
    assert.match(svg, /aria-label="Ada Lovelace: square ada lovelace"/);
  });

  test('mounted square working animates geometry across frames', () => {
    const dom = installDom();
    const { mountGlyph } = createTestRenderer();
    const handle = mountGlyph(dom.container, 'Ada Lovelace', { variant: 'square', state: 'working' });
    assert.equal(handle.variant, 'square');
    const geometry = () => dom.container.querySelector('svg > g').innerHTML;
    const initial = geometry();
    dom.advanceAnimationFrame(1000);
    const first = geometry();
    dom.advanceAnimationFrame(1033);
    const second = geometry();
    assert.notEqual(first, initial);
    assert.notEqual(second, first);
    handle.destroy();
  });

  test('setState waiting updates ring and aria-label', () => {
    const dom = installDom();
    const { mountGlyph } = createTestRenderer();
    const handle = mountGlyph(dom.container, 'Ada Lovelace', { variant: 'square', state: 'working' });
    handle.setState('waiting');
    const svg = dom.container.querySelector('svg');
    assert.match(svg.getAttribute('aria-label'), /, waiting$/);
    assert.equal(svg.querySelector('circle').getAttribute('stroke-dasharray'), '0.1 9');
    handle.destroy();
  });

  test('reduced motion keeps geometry static but still updates the ring', () => {
    const dom = installDom({ reducedMotion: true });
    const { mountGlyph } = createTestRenderer();
    const handle = mountGlyph(dom.container, 'Ada Lovelace', { variant: 'square', state: 'working' });
    assert.equal(dom.animationFrames, 0);
    const geometry = () => dom.container.querySelector('svg > g').innerHTML;
    const atWorking = geometry();
    handle.setState('waiting');
    assert.equal(geometry(), atWorking);
    const svg = dom.container.querySelector('svg');
    assert.equal(svg.querySelector('circle').getAttribute('stroke-dasharray'), '0.1 9');
    handle.destroy();
  });

  test('destroy empties host and removes prismicon class', () => {
    const dom = installDom();
    const { mountGlyph } = createTestRenderer();
    const handle = mountGlyph(dom.container, 'Ada Lovelace', { variant: 'square' });
    handle.destroy();
    assert.equal(dom.container.innerHTML, '');
    assert.equal(dom.container.classList.contains('prismicon'), false);
  });

  test('unknown variant id throws RangeError and leaves host untouched from static entry', () => {
    const { renderStaticSVG } = createTestRenderer();
    assert.throws(
      () => renderStaticSVG('x', { variant: 'triangle' }),
      (err) => err instanceof RangeError && /polyhedron, square/.test(err.message)
    );
  });

  test('unknown variant id throws RangeError and leaves host untouched from mount entry', async () => {
    const dom = installDom();
    // Fresh module so the engine singleton has not already been created against an earlier document.
    const { createRenderer: freshCreateRenderer } = await import('../src/core.js?no-style-unknown-id');
    const { mountGlyph } = freshCreateRenderer(createVariantRegistry([polyhedron, square], { defaultId: 'polyhedron' }));
    assert.throws(
      () => mountGlyph(dom.container, 'x', { variant: 'triangle' }),
      (err) => err instanceof RangeError && /polyhedron, square/.test(err.message)
    );
    assert.equal(dom.container.innerHTML, '');
    assert.equal(dom.container.classList.contains('prismicon'), false);
    assert.equal(document.getElementById('prismicon-style'), null, 'invalid variant must not inject global style');
  });

  test('invalid variant key throws before engine mutates the document', async () => {
    const dom = installDom();
    const { createRenderer: freshCreateRenderer } = await import('../src/core.js?no-style-invalid-key');
    const { mountGlyph } = freshCreateRenderer(createVariantRegistry([polyhedron, square], { defaultId: 'polyhedron' }));
    assert.throws(() => mountGlyph(dom.container, 'x', { variant: 42 }), TypeError);
    assert.equal(dom.container.innerHTML, '');
    assert.equal(dom.container.classList.contains('prismicon'), false);
    assert.equal(document.getElementById('prismicon-style'), null, 'invalid variant must not inject global style');
  });

  test('non-string variant key throws TypeError', () => {
    const { renderStaticSVG } = createTestRenderer();
    for (const key of [42, {}, [], true, Symbol('x')]) {
      assert.throws(() => renderStaticSVG('x', { variant: key }), TypeError);
    }
  });

  test('default renderer rejects square because it is not in BUILT_IN_VARIANTS', () => {
    const { renderStaticSVG } = createRenderer(createVariantRegistry([polyhedron], { defaultId: 'polyhedron' }));
    assert.throws(() => renderStaticSVG('x', { variant: 'square' }), RangeError);
  });

  test('polyhedron handle reports variant polyhedron and square handle reports variant square', () => {
    const dom = installDom();
    const { mountGlyph: mountPoly } = createRenderer(createVariantRegistry([polyhedron], { defaultId: 'polyhedron' }));
    const { mountGlyph: mountBoth } = createTestRenderer();
    const p = mountPoly(dom.container, 'x', {});
    assert.equal(p.variant, 'polyhedron');
    p.destroy();
    const s = mountBoth(dom.container, 'x', { variant: 'square' });
    assert.equal(s.variant, 'square');
    s.destroy();
  });

  test('square receiving state consults the variant flash hook and settles to rest', async () => {
    const dom = installDom();
    const flashCalls = [];
    const spiedSquare = { ...square, flash: (p, s) => { flashCalls.push(s); return square.flash(p, s); } };
    const { createRenderer: freshCreateRenderer } = await import('../src/core.js?flash-hook');
    const { mountGlyph } = freshCreateRenderer(createVariantRegistry([polyhedron, spiedSquare], { defaultId: 'polyhedron' }));
    const handle = mountGlyph(dom.container, 'Ada Lovelace', { variant: 'square', state: 'working' });
    const rotation = () => dom.container.querySelector('rect').getAttribute('transform');
    dom.advanceAnimationFrame(1000);
    assert.notEqual(rotation(), 'rotate(0.0 50 50)', 'working pose must be off rest before receiving');
    handle.setState('receiving');
    assert.deepEqual(flashCalls, ['receiving']);
    // receiving is transient (0.4 s) and then settles; drive frames until the square reports rest.
    let now = 1033;
    for (let i = 0; i < 200 && rotation() !== 'rotate(0.0 50 50)'; i++, now += 33) {
      dom.advanceAnimationFrame(now);
    }
    assert.equal(rotation(), 'rotate(0.0 50 50)', 'square must settle back to its rest pose');
    assert.match(dom.container.querySelector('svg').getAttribute('aria-label'), /, receiving$/);
    handle.destroy();
  });

  test('two renderers share one rAF chain', async () => {
    const dom = installDom();
    const host1 = document.createElement('div');
    const host2 = document.createElement('div');
    dom.container.appendChild(host1);
    dom.container.appendChild(host2);
    const { createRenderer: freshCreateRenderer } = await import('../src/core.js?shared-raf');
    const registry = createVariantRegistry([polyhedron, square], { defaultId: 'polyhedron' });
    const r1 = freshCreateRenderer(registry);
    const r2 = freshCreateRenderer(registry);
    const h1 = r1.mountGlyph(host1, 'a', { variant: 'square', state: 'working' });
    const h2 = r2.mountGlyph(host2, 'b', { variant: 'square', state: 'working' });
    assert.equal(dom.animationFrames, 1, 'two renderers must schedule exactly one shared frame');
    const g1 = () => host1.querySelector('svg > g').innerHTML;
    const g2 = () => host2.querySelector('svg > g').innerHTML;
    const before1 = g1();
    const before2 = g2();
    dom.advanceAnimationFrame(1000);
    assert.notEqual(g1(), before1);
    assert.notEqual(g2(), before2);
    h1.destroy();
    h2.destroy();
  });
});
