import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { NCUBE_SPEC_VERSION, deriveNcube } from '../src/variants/ncube.js';

// Spec ncube-v1 identities captured by features/2026/09/ncube-geometry-family.
// deriveNcube output for `ncube` (seed-derived dimension) and `ncube-4` (fixed
// dimension) is frozen: changing the draw order, NCUBE_MAX_DIMENSION or the
// theta count requires a new spec version, never an edit to this fixture.
const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'ncube-v1-identities.json');
const FROZEN = JSON.parse(readFileSync(fixturePath, 'utf8'));

test('fixture pins the ncube-v1 spec', () => {
  assert.equal(FROZEN.spec, 'ncube-v1');
  assert.equal(NCUBE_SPEC_VERSION, FROZEN.spec);
});

test('deriveNcube identities for the seed-derived ncube id are frozen', () => {
  for (const [seed, expected] of Object.entries(FROZEN.ncube)) {
    assert.deepEqual(deriveNcube(seed), expected, `ncube identity drifted for ${seed}`);
  }
});

test('deriveNcube identities for the fixed ncube-4 id are frozen', () => {
  for (const [seed, expected] of Object.entries(FROZEN['ncube-4'])) {
    assert.deepEqual(deriveNcube(seed, 4), expected, `ncube-4 identity drifted for ${seed}`);
    assert.equal(expected.dimension, 4);
  }
});
