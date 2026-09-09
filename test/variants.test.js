import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deriveV1, describeParams, renderStaticSVG } from '../src/core.js';
import {
  prepareParams,
  buildGeometry,
  poseForState,
  animatePose,
  paintFrame
} from '../src/variants/polyhedron.js';

const PARITY_OPTS = [{}, { size: 24 }, { kind: 'user' }, { state: 'thinking', dark: true }];
import { VARIANT_ID_PATTERN, createVariantRegistry, defineVariant } from '../src/variants/registry.js';
import { BUILT_IN_VARIANTS, DEFAULT_VARIANT_ID, resolveVariant, polyhedron, listVariants } from '../src/variants/index.js';

// Copied verbatim from test/derivation-freeze.test.js (frozen v1 engine, commit 9204c26).
const FROZEN = JSON.parse(`{
  "maya": {"spec":"v1","seed":"maya","hash":5672938920960816,"n":3,"solidType":0,"finish":1,"prop":0.75,"axisMode":0,"speed":-0.6900650275871157,"phase":4.301740389782586,"precess":false,"zSpeed":-0.17998544714646414,"phase2":1.8459765366751855,"hue":8,"hue2":145},
  "build-bot-7": {"spec":"v1","seed":"build-bot-7","hash":3896363917569,"n":4,"solidType":1,"finish":2,"prop":1.3,"axisMode":1,"speed":0.7468891458353027,"phase":3.8428703853993285,"precess":false,"zSpeed":-0.12171955700032414,"phase2":6.1943007512039125,"hue":275,"hue2":25},
  "Alice@X.com": {"spec":"v1","seed":"alice@x.com","hash":7287120426219225,"n":3,"solidType":2,"finish":0,"prop":0.75,"axisMode":0,"speed":-0.617978259245865,"phase":0.022091764370660297,"precess":true,"zSpeed":-0.16416204493725672,"phase2":3.4083078547770636,"hue":275,"hue2":25}
}`);

const HOOK_NAMES = ['derive', 'describe', 'prepare', 'geometry', 'pose', 'animate', 'paint'];

const noop = () => {};

function validDescriptor(overrides = {}) {
  return {
    id: 'sample',
    label: 'Sample',
    spec: 'v1',
    derive: noop,
    describe: noop,
    prepare: noop,
    geometry: noop,
    pose: noop,
    animate: noop,
    paint: noop,
    ...overrides
  };
}

function withoutKey(descriptor, key) {
  const { [key]: _omitted, ...rest } = descriptor;
  return rest;
}

describe('defineVariant', () => {
  test('returns a frozen copy of a valid descriptor', () => {
    const input = validDescriptor();
    const variant = defineVariant(input);
    assert.deepEqual(variant, input);
    assert.notEqual(variant, input);
    assert.ok(Object.isFrozen(variant));
    assert.ok(VARIANT_ID_PATTERN.test(variant.id));
  });

  test('rejects an id that does not match VARIANT_ID_PATTERN', () => {
    for (const id of ['Sample', '1abc', 'has space', 'under_score', '', undefined, 42]) {
      assert.throws(
        () => defineVariant(validDescriptor({ id })),
        { name: 'TypeError', message: /"id"/ },
        `id ${JSON.stringify(id)} should be rejected`
      );
    }
  });

  test('rejects a missing hook naming the field', () => {
    for (const hook of HOOK_NAMES) {
      assert.throws(
        () => defineVariant(withoutKey(validDescriptor(), hook)),
        { name: 'TypeError', message: new RegExp(`"${hook}"`) }
      );
    }
  });

  test('rejects a non-function hook naming the field', () => {
    for (const hook of HOOK_NAMES) {
      assert.throws(
        () => defineVariant(validDescriptor({ [hook]: 'not a function' })),
        { name: 'TypeError', message: new RegExp(`"${hook}"`) }
      );
    }
  });

  test('rejects unknown keys naming the key', () => {
    assert.throws(
      () => defineVariant(validDescriptor({ motion: {} })),
      { name: 'TypeError', message: /"motion"/ }
    );
  });

  test('rejects non-string or empty label and spec naming the field', () => {
    for (const field of ['label', 'spec']) {
      for (const value of ['', 7, null, undefined]) {
        assert.throws(
          () => defineVariant(validDescriptor({ [field]: value })),
          { name: 'TypeError', message: new RegExp(`"${field}"`) },
          `${field}=${JSON.stringify(value)} should be rejected`
        );
      }
    }
  });

  test('rejects non-object descriptors', () => {
    for (const bad of [null, undefined, 'polyhedron', [], 1]) {
      assert.throws(() => defineVariant(bad), TypeError);
    }
  });
});

describe('createVariantRegistry', () => {
  const alpha = validDescriptor({ id: 'alpha', label: 'Alpha' });
  const beta = validDescriptor({ id: 'beta', label: 'Beta' });
  const gamma = validDescriptor({ id: 'gamma', label: 'Gamma' });

  test('rejects duplicate ids', () => {
    assert.throws(
      () => createVariantRegistry([alpha, beta, validDescriptor({ id: 'alpha' })], { defaultId: 'alpha' }),
      { name: 'TypeError', message: /"alpha"/ }
    );
  });

  test('rejects an unregistered defaultId', () => {
    assert.throws(
      () => createVariantRegistry([alpha, beta], { defaultId: 'nope' }),
      { name: 'TypeError', message: /"nope"/ }
    );
    assert.throws(() => createVariantRegistry([alpha], {}), TypeError);
  });

  test('ids preserve registration order and are frozen', () => {
    const registry = createVariantRegistry([gamma, alpha, beta], { defaultId: 'beta' });
    assert.deepEqual(registry.ids, ['gamma', 'alpha', 'beta']);
    assert.ok(Object.isFrozen(registry.ids));
    assert.ok(Object.isFrozen(registry));
    assert.equal(registry.defaultId, 'beta');
  });

  test('has and get look up registered descriptors', () => {
    const registry = createVariantRegistry([alpha, beta], { defaultId: 'alpha' });
    assert.equal(registry.has('alpha'), true);
    assert.equal(registry.has('beta'), true);
    assert.equal(registry.has('gamma'), false);
    assert.deepEqual(registry.get('beta'), beta);
    assert.ok(Object.isFrozen(registry.get('beta')));
    assert.throws(() => registry.get('gamma'), RangeError);
  });

  test('resolve(undefined) and resolve(null) return the default descriptor', () => {
    const registry = createVariantRegistry([alpha, beta], { defaultId: 'beta' });
    assert.equal(registry.resolve(undefined), registry.get('beta'));
    assert.equal(registry.resolve(null), registry.get('beta'));
    assert.equal(registry.resolve(), registry.get('beta'));
  });

  test('resolve(string) returns the matching descriptor', () => {
    const registry = createVariantRegistry([alpha, beta], { defaultId: 'beta' });
    assert.equal(registry.resolve('alpha'), registry.get('alpha'));
  });

  test('resolve of an unknown id throws RangeError naming it and the registered ids', () => {
    const registry = createVariantRegistry([alpha, beta], { defaultId: 'alpha' });
    assert.throws(() => registry.resolve('nope'), (err) => {
      assert.ok(err instanceof RangeError);
      assert.match(err.message, /"nope"/);
      assert.match(err.message, /alpha, beta/);
      return true;
    });
  });

  test('resolve of a non-string key throws TypeError', () => {
    const registry = createVariantRegistry([alpha], { defaultId: 'alpha' });
    for (const key of [42, {}, [], true, Symbol('x')]) {
      assert.throws(() => registry.resolve(key), TypeError);
    }
  });
});

describe('polyhedron built-in variant', () => {
  test('is the registered default resolved by resolveVariant', () => {
    assert.equal(DEFAULT_VARIANT_ID, 'polyhedron');
    assert.deepEqual(BUILT_IN_VARIANTS.ids, ['polyhedron']);
    assert.equal(BUILT_IN_VARIANTS.defaultId, 'polyhedron');
    const registered = BUILT_IN_VARIANTS.get('polyhedron');
    assert.deepEqual(registered, polyhedron);
    assert.equal(registered.derive, deriveV1);
    assert.equal(registered.describe, describeParams);
    assert.equal(registered.prepare, prepareParams);
    assert.equal(registered.geometry, buildGeometry);
    assert.equal(registered.pose, poseForState);
    assert.equal(registered.animate, animatePose);
    assert.equal(registered.paint, paintFrame);
    assert.equal(resolveVariant(), registered);
    assert.equal(resolveVariant(null), registered);
    assert.equal(resolveVariant('polyhedron'), registered);
    assert.equal(polyhedron.spec, 'v1');
    assert.throws(() => resolveVariant('cube'), RangeError);
  });

  test('derive deep-equals deriveV1 and the frozen v1 fixture', () => {
    for (const [seed, expected] of Object.entries(FROZEN)) {
      assert.deepEqual(polyhedron.derive(seed), deriveV1(seed));
      assert.deepEqual(polyhedron.derive(seed), expected);
    }
  });

  test('describe matches describeParams', () => {
    for (const seed of Object.keys(FROZEN)) {
      const p = polyhedron.derive(seed);
      assert.equal(polyhedron.describe(p), describeParams(p));
    }
  });

  test('renderStaticSVG with explicit variant equals default renderStaticSVG', () => {
    for (const seed of Object.keys(FROZEN)) {
      for (const opts of PARITY_OPTS) {
        const actual = renderStaticSVG(seed, { ...opts, variant: 'polyhedron' });
        assert.equal(actual, renderStaticSVG(seed, opts), `${seed} ${JSON.stringify(opts)}`);
      }
    }
  });

  test('listVariants exposes only id, label and spec, frozen', () => {
    const info = listVariants();
    assert.deepEqual(info, [{ id: 'polyhedron', label: 'Polyhedron', spec: 'v1' }]);
    assert.ok(Object.isFrozen(info));
    assert.ok(info.every(Object.isFrozen));
  });
});

describe('public surface', () => {
  test('src/index.js exports exactly the eleven v1 names and nothing variant-related', async () => {
    const publicApi = await import('../src/index.js');
    const keys = Object.keys(publicApi).sort();
    assert.deepEqual(keys, [
      'FINISH_NAMES',
      'PALETTE',
      'SIDE_NAMES',
      'SOLID_NAMES',
      'SPEC_VERSION',
      'STATES',
      'deriveV1',
      'describeParams',
      'mountGlyph',
      'normalizeSeed',
      'renderStaticSVG'
    ]);
    assert.deepEqual(keys.filter((key) => /variant/i.test(key)), []);
  });
});
