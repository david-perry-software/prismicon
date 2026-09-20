import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateVariant } from '../src/variants/validate.js';
import {
  WRIGHT_SPEC_VERSION,
  deriveWright,
  describeWright,
  prepareWright,
  buildWright,
  poseWright,
  animateWright,
  paintWright,
  flashWright,
  wright
} from '../src/variants/wright.js';

test('wright scaffold derive is deterministic and normalized', () => {
  const a = deriveWright('Ada Lovelace');
  const b = deriveWright('  ada lovelace  ');
  assert.deepEqual(a, b);
  assert.equal(a.spec, WRIGHT_SPEC_VERSION);
  assert.ok(Object.isFrozen(a));
  assert.ok(a.lineCount >= 3 && a.lineCount <= 5);
  assert.ok(a.inset >= 10 && a.inset <= 21);
  assert.ok(a.emphasis === 'horizontal' || a.emphasis === 'vertical');
});

test('wright scaffold describe/prepare/geometry produce contract-valid shape', () => {
  const params = prepareWright(deriveWright('maya'), { size: 64 });
  const text = describeWright(params);
  assert.match(text, /Wright scaffold/);
  const geometry = buildWright(params);
  assert.ok(Object.isFrozen(geometry));
  assert.ok(Object.isFrozen(geometry.frame));
  assert.ok(Object.isFrozen(geometry.bands));
  assert.equal(geometry.bands.length, params.lineCount);
});

test('wright scaffold hooks animate deterministically and settle by identity', () => {
  const params = prepareWright(deriveWright('build-bot-7'), { size: 64 });
  const rest = poseWright(params, 'idle');
  const start = poseWright(params, 'working');
  const working = animateWright(start, { params, state: 'working', dt: 0.033, t: 1, transientT: 0, rest });
  assert.notDeepEqual(working, start);

  let pose = working;
  for (let i = 0; i < 120; i += 1) {
    pose = animateWright(pose, { params, state: 'settling', dt: 0.033, t: 1 + i * 0.033, transientT: 0, rest });
    if (pose === rest) break;
  }
  assert.equal(pose, rest);
});

test('wright scaffold paint and flash expose bounded, deterministic outputs', () => {
  const params = prepareWright(deriveWright('Alice@X.com'), { size: 64 });
  const geometry = buildWright(params);
  const pose = poseWright(params, 'idle');
  const svg = paintWright(params, geometry, pose, { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null });
  assert.match(svg, /<rect/);
  assert.match(svg, /<line/);
  assert.equal(flashWright(params, 'idle'), null);
  assert.deepEqual(flashWright(params, 'done'), { hue: params.hue2, lighten: 16, shake: false });
});

test('wright descriptor passes validateVariant', () => {
  validateVariant(wright);
});
