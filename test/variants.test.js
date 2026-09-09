import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { VARIANT_ID_PATTERN, defineVariant } from '../src/variants/registry.js';

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
