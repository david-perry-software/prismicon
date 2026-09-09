import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { VARIANT_ID_PATTERN, createVariantRegistry, defineVariant } from '../src/variants/registry.js';

const noop = () => {};

function validDescriptor(overrides = {}) {
  return {
    id: 'sample',
    label: 'Sample',
    spec: 'v1',
    derive: noop,
    describe: noop,
    renderStatic: noop,
    mount: noop,
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
    for (const hook of ['derive', 'describe', 'renderStatic', 'mount']) {
      assert.throws(
        () => defineVariant(withoutKey(validDescriptor(), hook)),
        { name: 'TypeError', message: new RegExp(`"${hook}"`) }
      );
    }
  });

  test('rejects a non-function hook naming the field', () => {
    for (const hook of ['derive', 'describe', 'renderStatic', 'mount']) {
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
