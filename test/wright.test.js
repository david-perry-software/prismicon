import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateVariant } from '../src/variants/validate.js';
import {
  WRIGHT_SPEC_VERSION,
  WRIGHT_FAMILIES,
  WRIGHT_DRAW_ORDER,
  WRIGHT_HYBRID_COMPATIBILITY,
  WRIGHT_LAYER_LIMITS,
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

test('wright grammar contract names Prairie, art-glass, textile-block, and Usonian families', async (t) => {
  assert.deepEqual(WRIGHT_FAMILIES, ['prairie', 'art-glass', 'textile-block', 'usonian']);
  assert.ok(Object.isFrozen(WRIGHT_FAMILIES));

  for (const family of WRIGHT_FAMILIES) {
    await t.test(family, () => {
      assert.ok(WRIGHT_HYBRID_COMPATIBILITY[family]);
    });
  }
});

test('wright grammar contract fixes draw order and bounds controlled hybrids', () => {
  assert.deepEqual(WRIGHT_DRAW_ORDER, [
    'dominantFamily', 'hybrid', 'secondaryFamily', 'massWidth',
    'massHeight', 'massOffset', 'planeCount', 'planeSpread',
    'gridColumns', 'gridRows', 'decoration', 'accent'
  ]);
  assert.ok(Object.isFrozen(WRIGHT_DRAW_ORDER));
  assert.ok(Object.isFrozen(WRIGHT_HYBRID_COMPATIBILITY));

  for (const family of WRIGHT_FAMILIES) {
    const compatible = WRIGHT_HYBRID_COMPATIBILITY[family];
    assert.ok(Object.isFrozen(compatible));
    assert.equal(compatible.length, 2);
    assert.equal(new Set(compatible).size, compatible.length);
    assert.ok(compatible.every((secondary) => WRIGHT_FAMILIES.includes(secondary) && secondary !== family));
  }
});

test('wright scaffold derive is deterministic and normalized', () => {
  const a = deriveWright('Ada Lovelace');
  const b = deriveWright('  ada lovelace  ');
  assert.deepEqual(a, b);
  assert.equal(a.spec, WRIGHT_SPEC_VERSION);
  assert.ok(Object.isFrozen(a));
  assert.ok(WRIGHT_FAMILIES.includes(a.dominantFamily));
  assert.ok(a.secondaryFamily === null || WRIGHT_HYBRID_COMPATIBILITY[a.dominantFamily].includes(a.secondaryFamily));
  assert.ok(a.planeCount >= 3 && a.planeCount <= 5);
  assert.ok(a.emphasis === 'horizontal' || a.emphasis === 'vertical');
});

test('wright geometry derivation reaches every dominant family and controlled hybrids', () => {
  const cases = [
    ['wright-family-1', 'prairie'],
    ['wright-family-5', 'art-glass'],
    ['wright-family-3', 'textile-block'],
    ['wright-family-0', 'usonian']
  ];
  for (const [seed, family] of cases) {
    assert.equal(deriveWright(seed).dominantFamily, family);
  }

  const hybrids = Array.from({ length: 32 }, (_, index) => deriveWright(`wright-hybrid-${index}`))
    .filter((params) => params.secondaryFamily !== null);
  assert.ok(hybrids.length > 0);
  for (const params of hybrids) {
    assert.ok(WRIGHT_HYBRID_COMPATIBILITY[params.dominantFamily].includes(params.secondaryFamily));
  }
});

test('wright scaffold describe/prepare/geometry produce contract-valid shape', () => {
  const params = prepareWright(deriveWright('maya'), { size: 64 });
  const text = describeWright(params);
  assert.match(text, /Wright composition/);
  const geometry = buildWright(params);
  assert.ok(Object.isFrozen(geometry));
  assert.equal(geometry.horizontalPlanes.length, params.planeCount);
});

test('wright geometry has a deeply frozen, finite, positive semantic hierarchy', () => {
  const seeds = ['wright-family-1', 'wright-family-5', 'wright-family-3', 'wright-family-0'];
  for (const seed of seeds) {
    const geometry = buildWright(prepareWright(deriveWright(seed), { size: 64 }));
    assert.ok(Object.isFrozen(geometry));
    for (const [layer, limit] of Object.entries(WRIGHT_LAYER_LIMITS)) {
      assert.ok(Object.isFrozen(geometry[layer]));
      assert.ok(geometry[layer].length >= 1 && geometry[layer].length <= limit, `${seed} ${layer} quota`);
      for (const item of geometry[layer]) {
        assert.ok(Object.isFrozen(item));
        assert.ok(Object.values(item).every(Number.isFinite), `${seed} ${layer} finite`);
        if ('width' in item) assert.ok(item.width > 0, `${seed} ${layer} positive width`);
        if ('height' in item) assert.ok(item.height > 0, `${seed} ${layer} positive height`);
      }
    }
  }
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
  assert.equal(svg, paintWright(params, geometry, pose, { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null }));
  const layers = ['primary-mass', 'horizontal-plane', 'grid-module', 'decoration', 'accent'];
  for (const layer of layers) assert.match(svg, new RegExp(`data-wright-layer="${layer}"`));
  for (let index = 1; index < layers.length; index += 1) {
    assert.ok(svg.indexOf(`data-wright-layer="${layers[index - 1]}"`) < svg.indexOf(`data-wright-layer="${layers[index]}"`));
  }
  assert.equal(flashWright(params, 'idle'), null);
  assert.deepEqual(flashWright(params, 'done'), { hue: params.hue2, lighten: 16, shake: false });
});

test('wright descriptor passes validateVariant', () => {
  validateVariant(wright);
});
