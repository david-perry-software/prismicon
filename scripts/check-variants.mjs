#!/usr/bin/env node
// Maintainer gate: fails when a built-in variant breaks the contract or the
// package surface drifts. Run with `npm run check:variants`.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUILT_IN_VARIANTS,
  DEFAULT_VARIANT_ID,
  VARIANT_ID_PATTERN,
  listVariants,
  validateVariant
} from '../src/variants/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

const EXPECTED_INDEX_EXPORTS = [
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
];
const EXPECTED_REACT_EXPORTS = ['Prismicon', 'PrismiconProvider', 'default'];
const EXPECTED_FILES = ['src', 'index.d.ts', 'README.md', 'LICENSE'];
const EXPECTED_EXPORT_KEYS = ['.', './react'];

async function checkContract() {
  const { ids } = BUILT_IN_VARIANTS;
  assert.ok(ids.length > 0, 'registry has no variants');
  assert.ok(ids.includes(DEFAULT_VARIANT_ID), `DEFAULT_VARIANT_ID '${DEFAULT_VARIANT_ID}' is not registered`);

  for (const id of ids) {
    assert.match(id, VARIANT_ID_PATTERN, `id '${id}' does not match VARIANT_ID_PATTERN`);
    const descriptor = BUILT_IN_VARIANTS.get(id);
    assert.ok(typeof descriptor.label === 'string' && descriptor.label.length > 0, `variant '${id}' has an empty label`);
    assert.ok(typeof descriptor.spec === 'string' && descriptor.spec.length > 0, `variant '${id}' has an empty spec`);
    validateVariant(descriptor);
  }

  const listed = listVariants().map(({ id }) => id);
  assert.deepEqual(listed, [...ids], 'listVariants() ids differ from BUILT_IN_VARIANTS.ids');
}

async function checkExports() {
  const [index, react] = await Promise.all([import('../src/index.js'), import('../src/react.js')]);
  assert.deepEqual(Object.keys(index).sort(), EXPECTED_INDEX_EXPORTS, 'src/index.js export list drifted');
  assert.deepEqual(Object.keys(react).sort(), EXPECTED_REACT_EXPORTS, 'src/react.js export list drifted');

  const pkg = readJson('package.json');
  assert.deepEqual(Object.keys(pkg.exports).sort(), EXPECTED_EXPORT_KEYS, 'package.json exports keys drifted');
  for (const key of EXPECTED_EXPORT_KEYS) {
    const entry = pkg.exports[key];
    assert.equal(entry.types, './index.d.ts', `exports['${key}'].types must be ./index.d.ts`);
    assert.ok(typeof entry.default === 'string' && existsSync(join(root, entry.default)), `exports['${key}'].default file is missing`);
  }
  assert.deepEqual([...pkg.files].sort(), [...EXPECTED_FILES].sort(), 'package.json files drifted');
  assert.equal(pkg.sideEffects, false, 'package.json sideEffects must be false');
  assert.equal(pkg.bin, undefined, 'package.json must not declare a bin');
}

const checks = [
  { name: 'contract', run: checkContract },
  { name: 'exports', run: checkExports }
];

let failed = false;
for (const { name, run } of checks) {
  try {
    await run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed = true;
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`✗ ${name}: ${reason.split('\n')[0]}`);
    if (reason.includes('\n')) console.error(reason.split('\n').slice(1).join('\n'));
    break;
  }
}

process.exit(failed ? 1 : 0);
