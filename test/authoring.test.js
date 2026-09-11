import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { JSDOM } from 'jsdom';

import { STATES, renderStaticSVG } from '../src/core.js';
import { BUILT_IN_VARIANTS } from '../src/variants/index.js';
import { PROBE_STATES, validateVariant } from '../src/variants/validate.js';
import { square } from './fixtures/square-variant.js';

const STATIC_SEEDS = ['maya', 'build-bot-7', 'Alice@X.com', 'Ada Lovelace', 'demo-agent'];
const PROBED_GLOBALS = ['window', 'document', 'navigator', 'matchMedia', 'requestAnimationFrame'];

const originalGlobals = {
  document: globalThis.document,
  IntersectionObserver: globalThis.IntersectionObserver,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  window: globalThis.window
};

afterEach(() => {
  Object.assign(globalThis, originalGlobals);
});

function installDom() {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="glyph"></div></body></html>');
  const frameCallbacks = [];
  dom.window.matchMedia = (query) => ({ matches: false, media: query });
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
    }
  };
}

function snapshotGlobals() {
  return PROBED_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
}

const builtInIds = [...BUILT_IN_VARIANTS.ids];
const builtInDescriptors = builtInIds.map((id) => BUILT_IN_VARIANTS.get(id));

const randomPaint = { ...square, id: 'bad', paint: (...args) => square.paint(...args) + Math.random() };
const windowDerive = {
  ...square,
  id: 'bad',
  derive: (seed) => ({ ...square.derive(seed), width: globalThis.window.innerWidth })
};
const emptyDescribe = { ...square, id: 'bad', describe: () => '' };
const numericFlash = { ...square, id: 'bad', flash: () => 42 };

async function loadAuthoring() {
  return import('../src/authoring.js');
}

describe('validateVariant', () => {
  test('accepts the square example and returns a frozen descriptor', () => {
    const validated = validateVariant(square);
    assert.ok(Object.isFrozen(validated));
    assert.deepEqual(Object.keys(validated).sort(), Object.keys(square).sort());
    assert.equal(validated.id, 'square');
    assert.equal(validated.paint, square.paint);
  });

  test('accepts every built-in descriptor', () => {
    for (const descriptor of builtInDescriptors) {
      const validated = validateVariant(descriptor);
      assert.ok(Object.isFrozen(validated));
      assert.equal(validated.id, descriptor.id);
    }
  });

  test('probes every engine state plus settling', () => {
    assert.deepEqual([...PROBE_STATES], [...STATES, 'settling']);
    assert.ok(Object.isFrozen(PROBE_STATES));
  });

  test('rejects a paint hook that uses Math.random (determinism probe)', () => {
    assert.throws(() => validateVariant(randomPaint), (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(error.message, /Variant "bad".*determinism.*paint/);
      return true;
    });
  });

  test('rejects a derive hook that reads window (SSR probe)', () => {
    installDom();
    assert.throws(() => validateVariant(windowDerive), (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(error.message, /Variant "bad".*"derive".*"window"/);
      return true;
    });
  });

  test('rejects a describe hook that returns an empty string', () => {
    assert.throws(() => validateVariant(emptyDescribe), (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(error.message, /Variant "bad"/);
      assert.match(error.message, /"describe"/);
      return true;
    });
  });

  test('rejects a flash hook that returns a number', () => {
    assert.throws(() => validateVariant(numericFlash), (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(error.message, /Variant "bad"/);
      assert.match(error.message, /"flash"/);
      return true;
    });
  });

  test('rejects shape errors through defineVariant', () => {
    assert.throws(() => validateVariant({ ...square, id: 'Bad Id' }), TypeError);
    assert.throws(() => validateVariant({ ...square, paint: 'nope' }), (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(error.message, /"paint"/);
      return true;
    });
  });

  test('restores globalThis descriptors after a passing SSR probe (no DOM)', () => {
    const before = snapshotGlobals();
    validateVariant(square);
    assert.deepEqual(snapshotGlobals(), before);
  });

  test('restores globalThis descriptors after a passing SSR probe (DOM installed)', () => {
    installDom();
    const before = snapshotGlobals();
    validateVariant(square);
    assert.deepEqual(snapshotGlobals(), before);
    assert.equal(globalThis.document.getElementById('glyph').id, 'glyph');
  });

  test('restores globalThis descriptors after a failing SSR probe', () => {
    installDom();
    const before = snapshotGlobals();
    assert.throws(() => validateVariant(windowDerive), TypeError);
    assert.deepEqual(snapshotGlobals(), before);
    assert.equal(typeof globalThis.window.innerWidth, 'number');
  });
});

describe('createPrismicon', () => {
  test('with no options lists exactly the built-ins and matches the module-level renderer', async () => {
    const { createPrismicon } = await loadAuthoring();
    const instance = createPrismicon();
    assert.ok(Object.isFrozen(instance));
    assert.deepEqual(Object.keys(instance).sort(), ['listVariants', 'mountGlyph', 'registry', 'renderStaticSVG']);
    assert.deepEqual(instance.listVariants().map((v) => v.id), builtInIds);
    assert.deepEqual([...instance.registry.ids], builtInIds);
    for (const seed of STATIC_SEEDS) {
      assert.equal(instance.renderStaticSVG(seed), renderStaticSVG(seed));
      for (const variant of builtInIds) {
        assert.equal(instance.renderStaticSVG(seed, { variant }), renderStaticSVG(seed, { variant }));
      }
    }
  });

  test('registers a custom variant after the built-ins', async () => {
    const { createPrismicon } = await loadAuthoring();
    const instance = createPrismicon({ variants: [square] });
    assert.ok(Object.isFrozen(instance));
    assert.deepEqual(instance.listVariants().map((v) => v.id), [...builtInIds, 'square']);
    assert.equal(instance.registry.defaultId, 'polyhedron');
    assert.ok(instance.registry.has('square'));
    assert.match(instance.renderStaticSVG('maya', { variant: 'square' }), /<rect/);
    assert.match(instance.renderStaticSVG('maya'), /<polygon|<path/);
    assert.equal(instance.renderStaticSVG('maya'), renderStaticSVG('maya'));
  });

  test('mounts a custom variant that animates', async () => {
    const dom = installDom();
    const { createPrismicon } = await loadAuthoring();
    const instance = createPrismicon({ variants: [square] });
    const handle = instance.mountGlyph(dom.container, 'maya', { variant: 'square', state: 'working' });
    assert.equal(handle.variant, 'square');
    const transform = () => dom.container.querySelector('rect').getAttribute('transform');
    const initial = transform();
    dom.advanceAnimationFrame(1000);
    assert.notEqual(transform(), initial);
    handle.destroy();
    assert.equal(dom.container.innerHTML, '');
  });

  test('rejects duplicate ids including shadowing a built-in', async () => {
    const { createPrismicon } = await loadAuthoring();
    assert.throws(() => createPrismicon({ variants: [{ ...square, id: 'polyhedron' }] }), (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(error.message, /Duplicate prismicon variant id/);
      return true;
    });
    assert.throws(() => createPrismicon({ variants: [square, square] }), /Duplicate prismicon variant id/);
  });

  test('builtIns: false requires defaultId to name a registered variant', async () => {
    const { createPrismicon } = await loadAuthoring();
    assert.throws(() => createPrismicon({ builtIns: false, variants: [square] }), (error) => {
      assert.equal(error.name, 'TypeError');
      assert.match(error.message, /Default variant "polyhedron" is not registered/);
      return true;
    });
    const isolated = createPrismicon({ builtIns: false, variants: [square], defaultId: 'square' });
    assert.deepEqual(isolated.listVariants().map((v) => v.id), ['square']);
    assert.match(isolated.renderStaticSVG('maya'), /<rect/);
    assert.throws(() => isolated.renderStaticSVG('maya', { variant: 'polyhedron' }), RangeError);
  });

  test('validate: false skips the probes but keeps the shape check', async () => {
    const { createPrismicon } = await loadAuthoring();
    assert.throws(() => createPrismicon({ variants: [randomPaint] }), /determinism/);
    assert.doesNotThrow(() => createPrismicon({ variants: [randomPaint], validate: false }));
    assert.throws(() => createPrismicon({ variants: [{ ...square, paint: 'nope' }], validate: false }), TypeError);
  });

  test('rejects a non-array variants option', async () => {
    const { createPrismicon } = await loadAuthoring();
    assert.throws(() => createPrismicon({ variants: 'nope' }), TypeError);
    assert.throws(() => createPrismicon({ variants: square }), TypeError);
  });

  test('instances are independent and do not touch the module-level registry', async () => {
    const { createPrismicon } = await loadAuthoring();
    const a = createPrismicon({ variants: [square] });
    const b = createPrismicon();
    assert.notEqual(a.registry, b.registry);
    assert.equal(b.registry.has('square'), false);
    assert.equal(BUILT_IN_VARIANTS.has('square'), false);
    assert.throws(() => renderStaticSVG('maya', { variant: 'square' }), RangeError);
  });
});

describe('root exports', () => {
  test('src/index.js exposes the authoring API alongside the existing surface', async () => {
    const publicApi = await import('../src/index.js');
    assert.deepEqual(Object.keys(publicApi).sort(), [
      'DEFAULT_VARIANT_ID',
      'FINISH_NAMES',
      'PALETTE',
      'SIDE_NAMES',
      'SOLID_NAMES',
      'SPEC_VERSION',
      'STATES',
      'VARIANT_ID_PATTERN',
      'createPrismicon',
      'createVariantRegistry',
      'defineVariant',
      'deriveV1',
      'describeParams',
      'listVariants',
      'mountGlyph',
      'normalizeSeed',
      'renderStaticSVG',
      'validateVariant'
    ]);
    assert.equal(typeof publicApi.createPrismicon, 'function');
    assert.equal(typeof publicApi.validateVariant, 'function');
    assert.equal(typeof publicApi.defineVariant, 'function');
    assert.equal(typeof publicApi.createVariantRegistry, 'function');
    assert.ok(publicApi.VARIANT_ID_PATTERN instanceof RegExp);
  });
});
