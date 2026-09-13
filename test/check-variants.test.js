import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts', 'check-variants.mjs');
const fixturesDir = join(root, 'test', 'fixtures');
const CHECK_NAMES = ['contract', 'exports', 'types', 'pack', 'goldens'];

function runCheck(env = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test('check-variants exits 0 and reports one ✓ per check on the committed fixtures', () => {
  const { status, output } = runCheck({ PRISMICON_CHECK_FIXTURES_DIR: fixturesDir });
  assert.equal(status, 0, output);
  const passed = output.split('\n').filter((line) => line.startsWith('✓ ')).map((line) => line.slice(2));
  assert.deepEqual(passed, CHECK_NAMES);
  assert.ok(!output.includes('✗'), output);
});

test('check-variants fails naming the registered id that has no golden entry', (t) => {
  const scratch = mkdtempSync(join(tmpdir(), 'prismicon-check-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const ncube = JSON.parse(readFileSync(join(fixturesDir, 'golden-ncube-v1.json'), 'utf8'));
  delete ncube['ncube-5'];
  writeFileSync(join(scratch, 'golden-ncube-v1.json'), JSON.stringify(ncube));
  copyFileSync(join(fixturesDir, 'golden-v1.json'), join(scratch, 'golden-v1.json'));

  const { status, output } = runCheck({ PRISMICON_CHECK_FIXTURES_DIR: scratch });
  assert.notEqual(status, 0, output);
  assert.match(output, /✗ goldens: .*ncube-5/);
  assert.match(output, /generate-golden\.mjs/);
});

// Regression test for #14 (variant-tooling-review-fixes): scratch fixture dirs must be removed.
// Snapshot taken before the suite's scratch-dir flow runs; top-level tests run sequentially,
// so by the time the last test executes the flow above has completed (including t.after cleanup).
const scratchDirsAtLoad = new Set(readdirSync(tmpdir()).filter((name) => /^prismicon-check-/.test(name)));

test('scratch fixture dirs are removed after the missing-golden flow runs', () => {
  const leaked = readdirSync(tmpdir()).filter((name) => /^prismicon-check-/.test(name) && !scratchDirsAtLoad.has(name));
  assert.deepEqual(leaked, [], `leaked scratch dirs in tmpdir: ${leaked.join(', ')}`);
});
