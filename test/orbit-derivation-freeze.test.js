import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { ORBIT_SPEC_VERSION, deriveOrbit } from '../src/variants/orbit.js';

// Spec orbit-v1 identities captured by features/2026/09/alternate-visual-variant.
// deriveOrbit output is frozen: changing the 22-draw order, ORBIT_MAX_RINGS or
// ORBIT_MAX_NODES requires a new spec version, never an edit to this fixture.
const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'orbit-v1-identities.json');
const FROZEN = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('fixture pins the orbit-v1 spec', () => {
  assert.equal(FROZEN.spec, 'orbit-v1');
  assert.equal(ORBIT_SPEC_VERSION, FROZEN.spec);
});

test('deriveOrbit identities are frozen', () => {
  for (const [seed, expected] of Object.entries(FROZEN.orbit)) {
    assert.deepEqual(deriveOrbit(seed), expected, `orbit identity drifted for ${seed}`);
  }
});
