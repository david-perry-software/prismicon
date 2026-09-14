import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { captureGolden, fixtureFor } from './helpers/golden.js';
import { BUILT_IN_VARIANTS, DEFAULT_VARIANT_ID } from '../src/variants/index.js';

const __filename = fileURLToPath(import.meta.url);
const fixturesDir = process.env.PRISMICON_CHECK_FIXTURES_DIR ?? join(dirname(__filename), 'fixtures');
const fixturePath = join(fixturesDir, 'golden-orbit-v1.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('the orbit variant has exactly one golden entry', () => {
  const expectedIds = BUILT_IN_VARIANTS.ids.filter((id) => id !== DEFAULT_VARIANT_ID && fixtureFor(id) === 'golden-orbit-v1.json');
  assert.deepEqual(
    Object.keys(fixture),
    expectedIds,
    'golden-orbit-v1.json keys must equal the registered orbit ids; regenerate with: node scripts/generate-golden.mjs'
  );
});

for (const [variant, expectedGolden] of Object.entries(fixture)) {
  test(`${variant} renderer output is byte-identical to the golden fixture`, async () => {
    const current = await captureGolden({ variant });

    const staticKeys = Object.keys(expectedGolden.static);
    const mountedKeys = Object.keys(expectedGolden.mounted);
    assert.deepEqual(Object.keys(current.static).sort(), staticKeys.sort());
    assert.deepEqual(Object.keys(current.mounted).sort(), mountedKeys.sort());

    for (const key of staticKeys) {
      assert.equal(
        current.static[key],
        expectedGolden.static[key],
        `static mismatch for ${variant} ${key}; regenerate with: node scripts/generate-golden.mjs`
      );
    }

    for (const key of mountedKeys) {
      const expected = expectedGolden.mounted[key];
      const actual = current.mounted[key];
      assert.equal(actual.length, expected.length, `mounted frame count mismatch for ${variant} ${key}`);
      for (let i = 0; i < expected.length; i += 1) {
        assert.equal(
          actual[i].hash,
          expected[i].hash,
          `mounted hash mismatch for ${variant} ${key} frame ${i} (state ${expected[i].state}, t ${expected[i].t}); regenerate with: node scripts/generate-golden.mjs`
        );
      }
    }
  });
}
