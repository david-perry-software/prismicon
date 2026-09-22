import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateVariant } from '../src/variants/validate.js';
import {
  WRIGHT_SPEC_VERSION,
  WRIGHT_FAMILIES,
  WRIGHT_DRAW_ORDER,
  WRIGHT_HYBRID_COMPATIBILITY,
  WRIGHT_LAYER_LIMITS,
  WRIGHT_VIEWBOX_BOUNDS,
  WRIGHT_PALETTE_FAMILIES,
  WRIGHT_PALETTES,
  WRIGHT_CONTRAST_PAIRS,
  WRIGHT_CONTRAST_MIN,
  WRIGHT_RED_AREA_CEILING,
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  deriveWright,
  describeWright,
  prepareWright,
  buildWright,
  poseWright,
  animateWright,
  paintWright,
  paintedAreaMetrics,
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

test('wright geometry and SVG stay stroke-aware and finite at sizes 24, 64, and 72', () => {
  const seeds = ['wright-family-1', 'wright-family-5', 'wright-family-3', 'wright-family-0'];
  for (const seed of seeds) {
    let expectedElementCount = null;
    for (const size of [24, 64, 72]) {
      const params = prepareWright(deriveWright(seed), { size });
      const geometry = buildWright(params);
      const layerStrokes = {
        primaryMasses: params.strokeWidth,
        horizontalPlanes: 0,
        gridModules: params.lightStroke,
        decorations: params.lightStroke,
        accents: geometry.accents[0].width
      };
      for (const [layer, items] of Object.entries(geometry)) {
        const halfStroke = layerStrokes[layer] / 2;
        for (const item of items) {
          const xs = 'x' in item ? [item.x, item.x + item.width] : [item.x1, item.x2];
          const ys = 'y' in item ? [item.y, item.y + item.height] : [item.y1, item.y2];
          assert.ok(Math.min(...xs) - halfStroke >= WRIGHT_VIEWBOX_BOUNDS.min, `${seed} ${size} ${layer} left`);
          assert.ok(Math.max(...xs) + halfStroke <= WRIGHT_VIEWBOX_BOUNDS.max, `${seed} ${size} ${layer} right`);
          assert.ok(Math.min(...ys) - halfStroke >= WRIGHT_VIEWBOX_BOUNDS.min, `${seed} ${size} ${layer} top`);
          assert.ok(Math.max(...ys) + halfStroke <= WRIGHT_VIEWBOX_BOUNDS.max, `${seed} ${size} ${layer} bottom`);
        }
      }
      const svg = paintWright(params, geometry, poseWright(params, 'idle'), {
        dark: false, sleeping: false, dx: 0, lighten: 0, flash: null
      });
      assert.doesNotMatch(svg, /NaN|Infinity/);
      const elementCount = (svg.match(/<(?:rect|line)\b/g) || []).length;
      expectedElementCount ??= elementCount;
      assert.equal(elementCount, expectedElementCount, `${seed} retains detail at size ${size}`);
    }
  }
});

test('wright palette families are deeply frozen with semantic light and dark roles', () => {
  assert.deepEqual(WRIGHT_PALETTE_FAMILIES, ['textile', 'stained-glass', 'concrete-wood']);
  assert.ok(Object.isFrozen(WRIGHT_PALETTE_FAMILIES));
  assert.ok(Object.isFrozen(WRIGHT_PALETTES));
  assert.ok(Object.isFrozen(WRIGHT_CONTRAST_PAIRS));
  const roles = ['canvas', 'primary', 'secondary', 'line', 'accent'];
  for (const family of WRIGHT_PALETTE_FAMILIES) {
    const palette = WRIGHT_PALETTES[family];
    assert.ok(Object.isFrozen(palette), `${family} frozen`);
    for (const mode of ['light', 'dark']) {
      const modeRoles = palette[mode];
      assert.ok(Object.isFrozen(modeRoles), `${family} ${mode} frozen`);
      for (const role of roles) {
        assert.match(modeRoles[role], /^#[0-9a-f]{6}$/, `${family} ${mode} ${role} must be 6-digit sRGB hex`);
      }
    }
  }
  for (const pair of WRIGHT_CONTRAST_PAIRS) {
    assert.ok(Object.isFrozen(pair));
    assert.equal(pair.length, 2);
  }
});

test('wright derive selects a palette family deterministically without reordering geometry draws', () => {
  const a = deriveWright('Ada Lovelace');
  const b = deriveWright('  ada lovelace  ');
  assert.equal(a.paletteFamily, b.paletteFamily);
  assert.ok(WRIGHT_PALETTE_FAMILIES.includes(a.paletteFamily));

  // Named seeds reach every family.
  assert.equal(deriveWright('wright-palette-1').paletteFamily, 'textile');
  assert.equal(deriveWright('wright-palette-11').paletteFamily, 'stained-glass');
  assert.equal(deriveWright('wright-palette-0').paletteFamily, 'concrete-wood');

  // Geometry-derived values stay byte-identical to the geometry-feature locks,
  // proving palette selection consumes no geometry draw and reorders nothing.
  const maya = deriveWright('maya');
  assert.deepEqual(
    [maya.dominantFamily, maya.secondaryFamily, maya.massWidth, maya.massHeight, maya.massOffset,
      maya.planeCount, maya.planeSpread, maya.gridColumns, maya.gridRows, maya.decoration, maya.accent],
    ['prairie', 'art-glass', 59, 38, 3, 5, 9, 5, 4, 2, 1]
  );
  const artGlass = deriveWright('wright-family-5');
  assert.deepEqual(
    [artGlass.dominantFamily, artGlass.secondaryFamily, artGlass.massWidth, artGlass.massHeight,
      artGlass.massOffset, artGlass.planeCount, artGlass.planeSpread, artGlass.gridColumns, artGlass.gridRows,
      artGlass.decoration, artGlass.accent],
    ['art-glass', null, 58, 51, 7, 5, 8, 4, 2, 0, 0]
  );

  // The corpus reaches all three families.
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) seen.add(deriveWright(`wright-palette-${i}`).paletteFamily);
  assert.deepEqual([...seen].sort(), [...WRIGHT_PALETTE_FAMILIES].sort());
});

test('wright motion traits derive deterministically from disjoint hash bits without new draws', () => {
  const a = prepareWright(deriveWright('maya'), { size: 64 });
  const b = prepareWright(deriveWright('  maya  '), { size: 64 });
  assert.deepEqual(a, b);

  assert.ok([-1, 1].includes(a.sweepDir), 'sweepDir is a sign');
  assert.ok(a.panelPhase >= 0 && a.panelPhase <= Math.PI * 2, 'panelPhase bounded');
  assert.ok(a.illumSpeed >= 0.7 && a.illumSpeed <= 1.3, 'illumSpeed bounded');

  // Motion traits must not perturb the frozen geometry/palette parameters or spec.
  const maya = deriveWright('maya');
  assert.equal(maya.spec, WRIGHT_SPEC_VERSION);
  assert.deepEqual(
    [maya.dominantFamily, maya.secondaryFamily, maya.massWidth, maya.massHeight, maya.massOffset,
      maya.planeCount, maya.planeSpread, maya.gridColumns, maya.gridRows, maya.decoration, maya.accent],
    ['prairie', 'art-glass', 59, 38, 3, 5, 9, 5, 4, 2, 1]
  );
});

test('wright paint uses semantic palette roles in light and dark contexts', () => {
  const seeds = ['wright-palette-1', 'wright-palette-11', 'wright-palette-0'];
  for (const seed of seeds) {
    const params = prepareWright(deriveWright(seed), { size: 64 });
    const geometry = buildWright(params);
    const pose = poseWright(params, 'idle');
    const family = params.paletteFamily;
    const palette = WRIGHT_PALETTES[family];
    const light = paintWright(params, geometry, pose, { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null });
    const dark = paintWright(params, geometry, pose, { dark: true, sleeping: false, dx: 0, lighten: 0, flash: null });

    const layers = ['primary-mass', 'horizontal-plane', 'grid-module', 'decoration', 'accent'];
    for (const layer of layers) assert.match(light, new RegExp(`data-wright-layer="${layer}"`));
    assert.doesNotMatch(light, /NaN|Infinity/);
    assert.doesNotMatch(dark, /NaN|Infinity/);
    assert.notEqual(light, dark, `${seed} light and dark render distinct`);

    // No-flash rendering emits the family's own frozen role colors.
    for (const role of ['primary', 'secondary', 'line', 'accent']) {
      assert.ok(light.includes(palette.light[role]), `${seed} light ${role} from palette`);
      assert.ok(dark.includes(palette.dark[role]), `${seed} dark ${role} from palette`);
    }
  }
});

test('wright paint interprets the motion pose with bounded illumination, panel pulse, and settle', () => {
  const params = prepareWright(deriveWright('maya'), { size: 64 });
  const geometry = buildWright(params);
  const rest = poseWright(params, 'idle');
  const effects = { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null };
  const restSvg = paintWright(params, geometry, rest, effects);

  // Rest rendering is deterministic and emits the frozen secondary role un-lit.
  assert.equal(restSvg, paintWright(params, geometry, rest, effects));
  const palette = WRIGHT_PALETTES[params.paletteFamily].light;

  const planeFills = (svg) => [...svg.matchAll(/data-wright-layer="horizontal-plane"[^>]*?fill="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
  const planeYs = (svg) => [...svg.matchAll(/data-wright-layer="horizontal-plane"[^>]*?y="([-0-9.]+)"/g)].map((m) => m[1]);
  const moduleStrokes = (svg) => [...svg.matchAll(/data-wright-layer="grid-module"[^>]*?stroke-width="([0-9.]+)"/g)].map((m) => m[1]);

  const restFills = planeFills(restSvg);
  assert.ok(restFills.length > 0);
  assert.ok(restFills.every((fill) => fill === palette.secondary), 'rest planes keep the frozen secondary role');

  const moved = Object.freeze({ illuminate: 0.5, panelPulse: 0.8, settle: 0.5 });
  const movedSvg = paintWright(params, geometry, moved, effects);
  assert.notEqual(movedSvg, restSvg);
  assert.doesNotMatch(movedSvg, /NaN|Infinity/);

  // Illumination lights at least one plane; settle shifts every plane; the panel
  // pulse changes the grid-module stroke. All structural layers keep their order
  // and data-wright-layer attributes.
  const movedFills = planeFills(movedSvg);
  assert.equal(movedFills.length, restFills.length, 'plane count unchanged');
  assert.ok(movedFills.some((fill) => fill !== palette.secondary), 'illumination changes a plane fill');
  assert.notDeepEqual(planeYs(movedSvg), planeYs(restSvg), 'settle shifts the planes');
  assert.ok(moduleStrokes(movedSvg).some((w) => w !== String(params.lightStroke)), 'panel pulse changes module stroke');

  const layers = ['primary-mass', 'horizontal-plane', 'grid-module', 'decoration', 'accent'];
  for (const layer of layers) assert.match(movedSvg, new RegExp(`data-wright-layer="${layer}"`));
  for (let i = 1; i < layers.length; i += 1) {
    assert.ok(movedSvg.indexOf(`data-wright-layer="${layers[i - 1]}"`) < movedSvg.indexOf(`data-wright-layer="${layers[i]}"`));
  }
});

test('wright contrast enforces unrounded WCAG 3:1 for structural roles in light dark and flash states', () => {
  // Standards-based sRGB helpers hold reference values.
  assert.deepEqual([...hexToRgb('#ffffff')], [255, 255, 255]);
  assert.ok(relativeLuminance(hexToRgb('#ffffff')) > 0.99);
  assert.ok(relativeLuminance(hexToRgb('#000000')) < 0.01);
  assert.ok(contrastRatio('#ffffff', '#000000') > 20);
  assert.equal(WRIGHT_CONTRAST_MIN, 3);

  // Every frozen role meets its adjacent-pair ratio, unrounded, in both modes.
  for (const family of WRIGHT_PALETTE_FAMILIES) {
    for (const mode of ['light', 'dark']) {
      const roles = WRIGHT_PALETTES[family][mode];
      for (const [against, role] of WRIGHT_CONTRAST_PAIRS) {
        const ratio = contrastRatio(roles[against], roles[role]);
        assert.ok(ratio >= WRIGHT_CONTRAST_MIN, `${family} ${mode} ${role} vs ${against} ratio ${ratio.toFixed(4)} < 3`);
      }
    }
  }

  const layerPairs = {
    'primary-mass': ['canvas', 'primary'],
    'horizontal-plane': ['canvas', 'secondary'],
    'grid-module': ['secondary', 'line'],
    decoration: ['secondary', 'line'],
    accent: ['canvas', 'accent']
  };
  const emittedColor = (svg, layer) => {
    const match = svg.match(new RegExp(`data-wright-layer="${layer}"[^>]*?(?:fill|stroke)="(#[0-9a-f]{6})"`));
    return match ? match[1] : null;
  };

  // Final emitted colors (including flash/lighten states) stay >= 3:1 against
  // their actual adjacent surface in light, dark, and transient-effect renders.
  const seeds = ['wright-palette-1', 'wright-palette-11', 'wright-palette-0', 'maya', 'Ada Lovelace'];
  for (const seed of seeds) {
    const params = prepareWright(deriveWright(seed), { size: 64 });
    const geometry = buildWright(params);
    const pose = poseWright(params, 'idle');
    const modes = WRIGHT_PALETTES[params.paletteFamily];
    for (const dark of [false, true]) {
      const canvas = modes[dark ? 'dark' : 'light'].canvas;
      const effectsList = [
        { dark, sleeping: false, dx: 0, lighten: 0, flash: null },
        { dark, sleeping: false, dx: 0, lighten: 16, flash: { hue: 4, strength: 0.75 } },
        { dark, sleeping: false, dx: 0, lighten: 10, flash: { hue: params.hue, strength: 0.5 } }
      ];
      for (const effects of effectsList) {
        const svg = paintWright(params, geometry, pose, effects);
        assert.doesNotMatch(svg, /NaN|Infinity/);
        const secondary = emittedColor(svg, 'horizontal-plane');
        assert.ok(secondary, `${seed} secondary color emitted`);
        for (const [layer, [againstRole, role]] of Object.entries(layerPairs)) {
          const color = emittedColor(svg, layer);
          assert.ok(color, `${seed} ${layer} color emitted`);
          const against = againstRole === 'canvas' ? canvas : secondary;
          const ratio = contrastRatio(color, against);
          assert.ok(ratio >= WRIGHT_CONTRAST_MIN, `${seed} ${layer} (${role}) dark=${dark} ratio ${ratio.toFixed(4)} < 3`);
        }
      }
    }
  }
});

test('wright red painted area stays within the 10 percent ceiling across seeds, sizes, and pulse states', () => {
  assert.equal(WRIGHT_RED_AREA_CEILING, 0.10);
  const seeds = ['wright-palette-1', 'wright-palette-11', 'wright-palette-0', 'maya', 'build-bot-7', 'Alice@X.com', 'wright-family-5', 'wright-family-0'];
  for (const seed of seeds) {
    for (const size of [24, 64, 72, 140]) {
      const params = prepareWright(deriveWright(seed), { size });
      const geometry = buildWright(params);
      for (const pulse of [1, 1.04, 1.08]) {
        const metrics = paintedAreaMetrics(geometry, params, pulse);
        assert.ok(metrics.total > 0, `${seed} ${size} total painted area positive`);
        // The red share is stroke footprint, not element count.
        const accentFootprint = geometry.accents.reduce(
          (sum, accent) => sum + Math.hypot(accent.x2 - accent.x1, accent.y2 - accent.y1) * (accent.width * pulse),
          0
        );
        assert.equal(metrics.red, accentFootprint, `${seed} ${size} red measured as stroke footprint`);
        assert.ok(metrics.red >= 0 && metrics.red <= metrics.total, `${seed} ${size} red bounded by total`);
        assert.ok(
          metrics.ratio <= WRIGHT_RED_AREA_CEILING,
          `${seed} ${size} pulse ${pulse} red ratio ${metrics.ratio.toFixed(4)} exceeds 10%`
        );
      }
    }
  }
});

test('wright rest pose is neutral so reduced-motion and static rendering are a single frozen frame', () => {
  const params = prepareWright(deriveWright('maya'), { size: 64 });
  for (const state of ['idle', 'waiting', 'thinking', 'sleeping', 'sending', 'receiving', 'done', 'error']) {
    assert.deepEqual(poseWright(params, state), { illuminate: -1, panelPulse: 0, settle: 0 });
  }
  assert.deepEqual(poseWright(params, 'working'), { illuminate: 0, panelPulse: 0.5, settle: 0 });
});

test('wright motion keeps every animated frame inside the viewBox and preserves the red ceiling', () => {
  const numericAttrs = (svg) => [...svg.matchAll(/(?:x|y|x1|y1|x2|y2|width|height)="(-?\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  const seeds = ['maya', 'build-bot-7', 'Alice@X.com', 'wright-family-5'];
  const states = ['working', 'waiting', 'thinking', 'sleeping', 'sending', 'receiving', 'settling'];
  for (const seed of seeds) {
    for (const size of [24, 64, 140]) {
      const params = prepareWright(deriveWright(seed), { size });
      const geometry = buildWright(params);
      const rest = poseWright(params, 'idle');
      for (const state of states) {
        let pose = state === 'working' ? poseWright(params, 'working') : rest;
        for (let frame = 0; frame < 8; frame += 1) {
          pose = animateWright(pose, { params, state, dt: 0.033, t: frame * 0.033, transientT: frame * 0.033, rest });
          const svg = paintWright(params, geometry, pose, {
            dark: false, sleeping: state === 'sleeping', dx: 0, lighten: 0, flash: null
          });
          assert.doesNotMatch(svg, /NaN|Infinity/, `${seed} ${size} ${state} f${frame} finite`);
          for (const value of numericAttrs(svg)) {
            assert.ok(value >= 0 && value <= 100, `${seed} ${size} ${state} f${frame} value ${value} inside viewBox`);
          }
        }
      }
      const metrics = paintedAreaMetrics(geometry, params);
      assert.ok(metrics.ratio <= WRIGHT_RED_AREA_CEILING, `${seed} ${size} red ratio ${metrics.ratio.toFixed(4)} > 10%`);
    }
  }
});

test('wright illumination keeps structural contrast >= 3:1 across animated frames', () => {
  const seeds = ['wright-palette-1', 'wright-palette-11', 'wright-palette-0', 'maya'];
  for (const seed of seeds) {
    const params = prepareWright(deriveWright(seed), { size: 64 });
    const geometry = buildWright(params);
    const rest = poseWright(params, 'idle');
    const modes = WRIGHT_PALETTES[params.paletteFamily];
    for (const dark of [false, true]) {
      const canvas = modes[dark ? 'dark' : 'light'].canvas;
      for (const state of ['working', 'thinking', 'sending', 'receiving']) {
        let pose = rest;
        for (let frame = 0; frame < 6; frame += 1) {
          pose = animateWright(pose, { params, state, dt: 0.033, t: frame * 0.033, transientT: frame * 0.033, rest });
          const svg = paintWright(params, geometry, pose, {
            dark, sleeping: false, dx: 0, lighten: 0, flash: null
          });
          for (const match of svg.matchAll(/data-wright-layer="horizontal-plane"[^>]*?fill="(#[0-9a-f]{6})"/g)) {
            assert.ok(
              contrastRatio(match[1], canvas) >= WRIGHT_CONTRAST_MIN,
              `${seed} dark=${dark} ${state} f${frame} plane vs canvas`
            );
          }
        }
      }
    }
  }
});

test('wright descriptor passes validateVariant', () => {
  validateVariant(wright);
});
