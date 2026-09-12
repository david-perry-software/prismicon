import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';

import { Prismicon } from '../src/react.js';
import { renderStaticSVG } from '../src/core.js';

const originalGlobals = {
  document: globalThis.document,
  IntersectionObserver: globalThis.IntersectionObserver,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  window: globalThis.window,
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT
};

afterEach(() => {
  Object.assign(globalThis, originalGlobals);
});

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="glyph"></div></body></html>');
  let animationFrames = 0;
  dom.window.matchMedia = (query) => ({ matches: false, media: query });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IntersectionObserver = undefined;
  globalThis.requestAnimationFrame = () => {
    animationFrames += 1;
    return animationFrames;
  };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return {
    container: dom.window.document.getElementById('glyph'),
    get animationFrames() {
      return animationFrames;
    }
  };
}

function element(props = {}) {
  return createElement(Prismicon, { seed: 'Ada Lovelace', ...props });
}

test('SSR explicit variant matches the default output', () => {
  const props = { size: 34, state: 'working', dark: true };
  const explicit = renderToStaticMarkup(element({ ...props, variant: 'polyhedron' }));
  const omitted = renderToStaticMarkup(element(props));

  assert.equal(explicit, omitted);
  assert.match(explicit, new RegExp(renderStaticSVG('Ada Lovelace', props).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('SSR rejects unknown and non-string variants', () => {
  assert.throws(() => renderToStaticMarkup(element({ variant: 'nope' })), (error) => {
    assert.equal(error.name, 'RangeError');
    assert.match(error.message, /nope/);
    assert.match(error.message, /polyhedron/);
    return true;
  });
  assert.throws(() => renderToStaticMarkup(element({ variant: 42 })), { name: 'TypeError' });
});

test('client mounts an explicit variant', async () => {
  const dom = installDom();
  const root = createRoot(dom.container);

  await act(() => root.render(element({ variant: 'polyhedron', state: 'working' })));

  assert.equal(dom.container.querySelector('span').className, 'prismicon');
  assert.match(dom.container.querySelector('svg').getAttribute('aria-label'), /^Ada Lovelace: .+, working$/);
  assert.ok(dom.animationFrames > 0);
  root.unmount();
});

test('client reports render-time variant errors', async () => {
  const dom = installDom();
  const errors = [];
  const root = createRoot(dom.container, { onUncaughtError: (error) => errors.push(error) });

  try {
    await act(() => root.render(element({ variant: 'nope' })));
  } catch (error) {
    errors.push(error);
  }

  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, 'RangeError');
  assert.equal(dom.container.querySelector('svg'), null);
  root.unmount();
});

test('variant changes remount while state changes preserve the SVG', async () => {
  const dom = installDom();
  const root = createRoot(dom.container);

  await act(() => root.render(element({ state: 'working' })));
  const firstSvg = dom.container.querySelector('svg');
  await act(() => root.render(element({ variant: 'polyhedron', state: 'working' })));
  const secondSvg = dom.container.querySelector('svg');
  assert.notEqual(secondSvg, firstSvg);
  assert.match(secondSvg.getAttribute('aria-label'), /, working$/);

  await act(() => root.render(element({ variant: 'polyhedron', state: 'done' })));
  assert.equal(dom.container.querySelector('svg'), secondSvg);
  assert.match(secondSvg.getAttribute('aria-label'), /, done$/);
  root.unmount();
});

test('invalid variant updates report without mounting a second glyph', async () => {
  const dom = installDom();
  const errors = [];
  const root = createRoot(dom.container, { onUncaughtError: (error) => errors.push(error) });

  await act(() => root.render(element({ variant: 'polyhedron' })));
  const originalSvg = dom.container.querySelector('svg');
  try {
    await act(() => root.render(element({ variant: 'nope' })));
  } catch (error) {
    errors.push(error);
  }

  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, 'RangeError');
  assert.ok(dom.container.querySelectorAll('svg').length <= 1);
  assert.notEqual(dom.container.querySelector('svg'), originalSvg);
  root.unmount();
});

test('hydration of an explicit variant has no recoverable errors', async () => {
  const dom = installDom();
  const props = { variant: 'polyhedron', state: 'working' };
  dom.container.innerHTML = renderToString(element(props));
  const errors = [];

  await act(() => hydrateRoot(dom.container, element(props), {
    onRecoverableError: (error) => errors.push(error)
  }));

  assert.deepEqual(errors, []);
  assert.equal(dom.container.querySelector('span').className, 'prismicon');
  assert.match(dom.container.querySelector('svg').getAttribute('aria-label'), /, working$/);
});

test('React entry exports the component and provider surface', async () => {
  assert.deepEqual(Object.keys(await import('../src/react.js')).sort(), ['Prismicon', 'PrismiconProvider', 'default']);
});

// Provider cases load the authoring API and provider lazily so the cases above
// keep running until `src/authoring.js` and `PrismiconProvider` exist.
async function loadProviderApi() {
  const [{ createPrismicon }, { PrismiconProvider }, { square }] = await Promise.all([
    import('../src/authoring.js'),
    import('../src/react.js'),
    import('./fixtures/square-variant.js')
  ]);
  assert.equal(typeof PrismiconProvider, 'function', 'PrismiconProvider must be exported');
  return { createPrismicon, PrismiconProvider, square };
}

function provided(PrismiconProvider, registry, props) {
  return createElement(PrismiconProvider, { registry }, createElement(Prismicon, { seed: 'maya', ...props }));
}

test('provider SSR renders a custom variant identically to the instance renderer', async () => {
  const { createPrismicon, PrismiconProvider, square } = await loadProviderApi();
  const instance = createPrismicon({ variants: [square] });
  const props = { variant: 'square', size: 40, state: 'working' };

  const markup = renderToStaticMarkup(provided(PrismiconProvider, instance.registry, props));

  assert.ok(markup.includes(instance.renderStaticSVG('maya', props)));
  assert.match(markup, /<rect/);
  const builtIn = renderToStaticMarkup(provided(PrismiconProvider, instance.registry, { size: 40 }));
  assert.ok(builtIn.includes(renderStaticSVG('maya', { size: 40 })));
});

test('the same tree without a provider rejects the custom id', async () => {
  const { createPrismicon, square } = await loadProviderApi();
  createPrismicon({ variants: [square] });

  assert.throws(() => renderToStaticMarkup(element({ seed: 'maya', variant: 'square' })), (error) => {
    assert.equal(error.name, 'RangeError');
    assert.match(error.message, /square/);
    return true;
  });
});

test('client mount inside the provider renders the custom variant', async () => {
  const dom = installDom();
  const { createPrismicon, PrismiconProvider, square } = await loadProviderApi();
  const instance = createPrismicon({ variants: [square] });
  const root = createRoot(dom.container);

  await act(() => root.render(provided(PrismiconProvider, instance.registry, { variant: 'square', state: 'working' })));

  assert.equal(dom.container.querySelector('span').className, 'prismicon');
  assert.ok(dom.container.querySelector('rect'));
  assert.match(dom.container.querySelector('svg').getAttribute('aria-label'), /^maya: square maya, working$/);
  await act(() => root.unmount());
});

test('replacing the registry prop remounts the glyph while keeping state', async () => {
  const dom = installDom();
  const { createPrismicon, PrismiconProvider, square } = await loadProviderApi();
  const first = createPrismicon({ variants: [square] });
  const second = createPrismicon({ variants: [square] });
  const root = createRoot(dom.container);

  await act(() => root.render(provided(PrismiconProvider, first.registry, { variant: 'square', state: 'working' })));
  const firstSvg = dom.container.querySelector('svg');
  await act(() => root.render(provided(PrismiconProvider, first.registry, { variant: 'square', state: 'working' })));
  assert.equal(dom.container.querySelector('svg'), firstSvg, 'same registry identity must not remount');

  await act(() => root.render(provided(PrismiconProvider, second.registry, { variant: 'square', state: 'working' })));
  const secondSvg = dom.container.querySelector('svg');
  assert.notEqual(secondSvg, firstSvg);
  assert.ok(secondSvg.querySelector('rect'));
  assert.match(secondSvg.getAttribute('aria-label'), /, working$/);
  assert.equal(dom.container.querySelectorAll('svg').length, 1);
  await act(() => root.unmount());
});

test('a non-registry registry prop reports a TypeError', async () => {
  const dom = installDom();
  const { PrismiconProvider } = await loadProviderApi();
  const errors = [];
  const root = createRoot(dom.container, { onUncaughtError: (error) => errors.push(error) });

  try {
    await act(() => root.render(provided(PrismiconProvider, {}, { variant: 'polyhedron' })));
  } catch (error) {
    errors.push(error);
  }

  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, 'TypeError');
  assert.match(errors[0].message, /PrismiconProvider "registry" must be a variant registry/);
  assert.equal(dom.container.querySelector('svg'), null);
  await act(() => root.unmount());
});