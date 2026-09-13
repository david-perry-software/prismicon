#!/usr/bin/env node
// Maintainer gate: fails when a built-in variant breaks the contract or the
// package surface drifts. Run with `npm run check:variants`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BUILT_IN_VARIANTS,
  DEFAULT_VARIANT_ID,
  VARIANT_ID_PATTERN,
  listVariants,
  validateVariant
} from '../src/variants/index.js';
import { captureGolden, fixtureFor } from '../test/helpers/golden.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = process.env.PRISMICON_CHECK_FIXTURES_DIR ?? join(root, 'test', 'fixtures');
const REGENERATE_HINT = 'regenerate with: node scripts/generate-golden.mjs';
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
const TSC_ARGS = ['--noEmit', '--strict', '--target', 'es2020', '--lib', 'es2020,dom', 'index.d.ts'];
const FORBIDDEN_PACK_PREFIXES = ['test/', 'scripts/', 'demo/', '.github/'];

// Windows has no bare `npm` executable (only `npm.cmd`); select per platform.
const npmCommand = (platform = process.platform) => (platform === 'win32' ? 'npm.cmd' : 'npm');

function listFilesUnder(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? listFilesUnder(rel) : [rel];
  });
}

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

async function checkTypes() {
  const tsc = join(root, 'node_modules', '.bin', 'tsc');
  assert.ok(existsSync(tsc), 'node_modules/.bin/tsc is missing; run npm ci');
  const result = spawnSync(tsc, TSC_ARGS, { cwd: root, encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    `tsc ${TSC_ARGS.join(' ')} exited ${result.status}\n${(result.stdout + result.stderr).trim()}`
  );
}

async function checkPack() {
  const result = spawnSync(npmCommand(), ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `npm pack --dry-run exited ${result.status}\n${result.stderr.trim()}`);
  const parsed = JSON.parse(result.stdout);
  // npm 10 emits [{ files: [{ path }] }]; tolerate a bare file array too.
  const entries = Array.isArray(parsed) && parsed[0]?.files ? parsed[0].files : parsed;
  const packed = entries.map((entry) => (typeof entry === 'string' ? entry : entry.path)).sort();

  const expected = EXPECTED_FILES.flatMap((entry) => (statSync(join(root, entry)).isDirectory() ? listFilesUnder(entry) : [entry]))
    .concat('package.json')
    .map((path) => relative(root, join(root, path)))
    .sort();
  assert.deepEqual(packed, expected, 'npm pack file list differs from package.json files');

  const leaked = packed.filter((path) => FORBIDDEN_PACK_PREFIXES.some((prefix) => path.startsWith(prefix)));
  assert.deepEqual(leaked, [], `npm pack would publish maintainer-only files: ${leaked.join(', ')}`);
}

function loadFixture(file) {
  const path = join(fixturesDir, file);
  assert.ok(existsSync(path), `golden fixture ${file} is missing from ${fixturesDir}; ${REGENERATE_HINT}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

// The default variant's fixture is the bare golden; every other id is keyed inside its family file.
function expectedGoldenFor(id) {
  const fixture = loadFixture(fixtureFor(id));
  if (id === DEFAULT_VARIANT_ID) return fixture;
  assert.ok(Object.hasOwn(fixture, id), `variant '${id}' has no golden entry in ${fixtureFor(id)}; ${REGENERATE_HINT}`);
  return fixture[id];
}

async function checkGoldens() {
  for (const id of BUILT_IN_VARIANTS.ids) {
    const expected = expectedGoldenFor(id);
    const actual = await captureGolden(id === DEFAULT_VARIANT_ID ? {} : { variant: id });
    assert.deepEqual(actual, expected, `golden for variant '${id}' is stale; ${REGENERATE_HINT}`);
  }
}

const checks = [
  { name: 'contract', run: checkContract },
  { name: 'exports', run: checkExports },
  { name: 'types', run: checkTypes },
  { name: 'pack', run: checkPack },
  { name: 'goldens', run: checkGoldens }
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
