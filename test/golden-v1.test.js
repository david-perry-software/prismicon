import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { captureGolden } from './helpers/golden.js';

const __filename = fileURLToPath(import.meta.url);
const fixturePath = join(dirname(__filename), 'fixtures', 'golden-v1.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('default renderer output is byte-identical to the golden fixture', async () => {
  const current = await captureGolden();

  const staticKeys = Object.keys(fixture.static);
  const mountedKeys = Object.keys(fixture.mounted);
  assert.deepEqual(Object.keys(current.static).sort(), staticKeys.sort());
  assert.deepEqual(Object.keys(current.mounted).sort(), mountedKeys.sort());

  for (const key of staticKeys) {
    assert.equal(
      current.static[key],
      fixture.static[key],
      `static mismatch for ${key}; regenerate with: node scripts/generate-golden.mjs`
    );
  }

  for (const key of mountedKeys) {
    const expected = fixture.mounted[key];
    const actual = current.mounted[key];
    assert.equal(actual.length, expected.length, `mounted frame count mismatch for ${key}`);
    for (let i = 0; i < expected.length; i += 1) {
      assert.equal(
        actual[i].hash,
        expected[i].hash,
        `mounted hash mismatch for ${key} frame ${i} (state ${expected[i].state}, t ${expected[i].t}); regenerate with: node scripts/generate-golden.mjs`
      );
    }
  }
});
