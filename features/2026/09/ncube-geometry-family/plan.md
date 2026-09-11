# N-cube geometry family

## Problem

prismicon ships one built-in visual variant, `polyhedron` (the frozen v1 3D identicon
engine). The variant registry and the shared renderer already dispatch to any
descriptor, but consumers still have nothing to choose *between*. This feature adds the
first rich built-in family: deterministic projected n-cubes (cube, tesseract,
penteract, …) rendered onto the same 100×100 plane, starting at dimension 3 and going
as high as a measured, documented practical bound allows.

It implements the `### ncube-geometry-family` member of the
[scalable-icon-variants breakdown](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
(initiative `scalable-icon-variants`, wave 3; requires `variant-renderer-integration`,
which is `complete`).

Member brief (verbatim): *Add the first variant family based on different dimensional
n-cubes represented in a 3D plane, starting at 3 and going as high as practical.*
Member summary: *Provide deterministic projected n-cube geometry beginning at dimension
3 and establish a tested practical upper bound based on legibility and rendering cost.*

User-visible effect: `renderStaticSVG(seed, { variant: 'ncube' })`,
`mountGlyph(el, seed, { variant: 'ncube-4' })`, and `<Prismicon variant="ncube-5" />`
render a seed-stable projected n-cube in static, mounted, and reduced-motion contexts;
`listVariants()` and the browser demo present the whole family. Motion is explicitly
deferred to `ncube-motion-system`.

## Decisions

Clarifying questions asked on 2026-09-10 and the user's answers (verbatim):

1. **Variant identity** — How should n-cube dimensions be exposed to consumers — one
   variant id per dimension, or one variant with the dimension derived from the seed?
   → **Both: an `ncube` seed-derived id plus per-dimension ids**
2. **Upper bound** — How should the practical maximum dimension be decided and
   enforced?
   → **Measure and fix a hard constant in code (e.g. MAX_DIMENSION)**
3. **Static rendering** — Motion is a later feature (ncube-motion-system). What should
   this feature's `animate`/`pose` hooks do?
   → **Static: pose returns a seed-derived rest orientation; animate returns rest
   immediately**
4. **Seed-derived traits** — Which visual traits should the seed derive for an n-cube
   icon (besides the hues)?
   → **Higher-dimensional rotation angles (the projection pose)**, **Finish (shaded /
   two-tone / wireframe), mirroring polyhedron**
5. **Demo & types** — Should this feature also update the browser demo and index.d.ts
   to present/type the new ids?
   → **Yes — add ncube ids to index.d.ts and a dimension gallery to demo/index.html**

## Research

Skills consulted: modern-javascript-patterns (ESM module layout, immutability, pure
functions, `const`/spread over mutation — applied to the new variant module and the
shared seed helpers). vercel-react-best-practices was reviewed against the skills table
but not applied: `src/react.js` needs no change (see below).

### Variant contract and renderer (already shipped)

- [src/variants/registry.js](../../../../src/variants/registry.js#L1-L60) defines the
  eight-hook descriptor (`derive`, `describe`, `prepare`, `geometry`, `pose`,
  `animate`, `paint`, `flash`), `defineVariant` (validates + freezes; rejects unknown
  keys) and `createVariantRegistry` (immutable, duplicate ids throw, `resolve(null)` →
  default, unknown id → `RangeError`, non-string → `TypeError`).
- [src/variants/index.js](../../../../src/variants/index.js#L1-L31) builds
  `BUILT_IN_VARIANTS = createVariantRegistry([polyhedron], { defaultId: 'polyhedron' })`
  and exposes `resolveVariant` and `listVariants` (frozen `{ id, label, spec }` list in
  registration order). Adding a family means a longer descriptor array here — no
  mutation API by design.
- [src/core.js](../../../../src/core.js#L75-L90) `renderStaticSVG` calls
  `resolve → derive → prepare → geometry → pose(params,'idle') → paint` and wraps the
  result in the shared `viewBox="0 0 100 100"` shell with the ring and the aria label
  `"<seed>: <describe(params)>[, <state>]"`. [`mountGlyph`](../../../../src/core.js#L93-L180)
  resolves the variant *before* any DOM mutation, then runs the same chain; the engine
  loop ([step](../../../../src/core.js#L316-L391)) calls
  `animate(pose, { params, state, dt, t, transientT, rest })` per frame and repaints
  only when the pose object changes or a flash effect is active; `settling → idle`
  when `animate` returns `ctx.rest`. Reduced motion is detected once via `matchMedia`
  and skips the engine entirely. Shared infrastructure (ring, aria, dark mode,
  `effects.sleeping`, `effects.dx` shake, `effects.lighten`, `effects.flash`) is
  variant-agnostic, so a static family needs only the eight hooks.
- [src/react.js](../../../../src/react.js#L27-L56) passes `variant` straight through
  to `renderStaticSVG`/`mountGlyph` and remounts on `variant` change. Nothing in it is
  variant-specific; new ids work with no React change.

### Polyhedron as the template

- [src/variants/polyhedron.js](../../../../src/variants/polyhedron.js) (349 lines)
  keeps `cyrb53` (L36) and `mulberry32` (L48) **private**; only `normalizeSeed`,
  `deriveV1`, `describeParams`, `PALETTE`, `FINISH_NAMES`, etc. are exported. The
  n-cube family must use the same hash/PRNG for seed stability across variants, so the
  two helpers are moved into a shared `src/variants/seed.js` and re-imported by
  polyhedron (a pure move; the golden and freeze tests guarantee no v1 output change).
- Projection convention: vertices in a ~±26-unit 3D space, rotated by `rot3` (L138,
  ZYX Euler), projected with focal length `F = 150` as `s = F / (F - z)` around
  `(50, 50)`, coordinates emitted with `toFixed(1)`. Colors use
  `hsl(<h> 52% <L>%)` via `ink()`, shading ramps from `shadeFor(dark)`
  (L169: light `{ base: 30, range: 28, edge: 24, wire: 45 }`, dark
  `{ base: 40, range: 26, edge: 78, wire: 62 }`), wireframe stroke 3.5. `prepare`
  (L226) downgrades wireframe to shaded below size 28. `flash` (L329): receiving →
  `{ hue, lighten: 26 }`, done → `{ hue: 145 }`, error → `{ hue: 4, shake: true }`.
- Hue draw: `hue = PALETTE[hash % 12]`, `hue2 = PALETTE[(idx + 4) % 12]`.

### Tests and fixtures that this feature touches

- [test/variants.test.js](../../../../test/variants.test.js#L185) asserts
  `BUILT_IN_VARIANTS.ids` deep-equals `['polyhedron']`, and
  [L250-L253](../../../../test/variants.test.js#L250-L253) /
  [L277](../../../../test/variants.test.js#L277) assert `listVariants()` deep-equals the
  single polyhedron entry. These three assertions must be rewritten to "polyhedron is
  first and default, followed by the n-cube ids in order"; the thirteen-name
  `src/index.js` surface assertion at L258-L275 stays valid because this plan adds no
  runtime exports.
- [test/fixtures/square-variant.js](../../../../test/fixtures/square-variant.js) is
  the minimal descriptor template (exports each hook plus the assembled object).
- [test/helpers/golden.js](../../../../test/helpers/golden.js#L1-L30) hard-codes
  `STATIC_SEEDS`, `STATIC_OPTS`, `MOUNTED_SCENARIOS` for the polyhedron and
  [scripts/generate-golden.mjs](../../../../scripts/generate-golden.mjs) writes
  [test/fixtures/golden-v1.json](../../../../test/fixtures/golden-v1.json) (30 static
  SVG strings + 5 mounted frame-hash scenarios). The helper needs a `variant`
  parameter so the family can get its own golden file without changing the v1 file.
- [test/derivation-freeze.test.js](../../../../test/derivation-freeze.test.js) pins
  three v1 identities; the same approach is used for the `ncube-v1` spec.
- Test runner: `node --test test/*.test.js` (node:test + `assert/strict`, JSDOM for
  DOM cases).

### Public surface and docs

- [index.d.ts](../../../../index.d.ts#L27-L57): `GlyphOptions.variant?: string`,
  `GlyphHandle.params: GlyphParams` (polyhedron-shaped), `VariantInfo`,
  `DEFAULT_VARIANT_ID`, `listVariants()`;
  [PrismiconProps.variant?: string](../../../../index.d.ts#L70-L72). No id union exists.
- [README.md](../../../../README.md#L107-L126) `## Variants` sits between
  `## Vanilla API` and `## Derivation spec v1 (frozen)`; it lists
  `[{ id: 'polyhedron', … }]` as the `listVariants()` output.
- [demo/index.html](../../../../demo/index.html#L36-L89) already has a
  `<select id="variant">` populated from `listVariants()` that remounts the hero glyph;
  new ids appear there automatically. There is no per-dimension comparison row yet.
- [package.json](../../../../package.json): `"type": "module"`, `"sideEffects": false`,
  `"files": ["src", "index.d.ts", "README.md", "LICENSE"]` (tests and `scripts/` are
  not published), `"test": "node --test test/*.test.js"`, no build step.

### N-cube facts (drive the bound)

A d-cube has $2^d$ vertices, $d\cdot2^{d-1}$ edges and $\binom{d}{2}2^{d-2}$ square
2-faces: d=3 → 8/12/6, d=4 → 16/32/24, d=5 → 32/80/80, d=6 → 64/192/240,
d=7 → 128/448/672, d=8 → 256/1024/1792. Face-painted finishes therefore grow roughly
3× per dimension; the wireframe finish grows ~2.3×. The bound is decided by
measurement (see Approach) rather than guessed.

### Lint baseline and overlap decision (policy §5)

- AGENTS.md declares `Lint: none` and `Typecheck: none`; the only full-repository
  verification is `npm test`.
- Baseline run on 2026-09-10 at `origin/main` 5a2cd5a in this planning worktree:
  `npm ci && npm test` → exit 0, `# tests 60`, `# pass 60`, `# fail 0` (6 suites).
- Findings: none. Overlap: not applicable (no lint findings exist). The gate for this
  delivery is therefore the **full** `npm test` run (never a changed-files subset),
  plus the additional machine checks listed in the acceptance checklist (golden
  regeneration diff, `npm pack --dry-run` file list, `index.d.ts` compile check with
  the single pre-existing TS7016 for `react` as in the previous roadmap).
- Concurrent deliveries: `gh pr list --state open` returned `[]` on 2026-09-10; no
  overlapping branch exists.

## Approach

### Module layout

1. **`src/variants/seed.js`** (new) — move `cyrb53` and `mulberry32` here verbatim and
   export them; `polyhedron.js` imports them. No other polyhedron change. The golden,
   freeze and dispatch tests must stay byte-identical (`golden-v1.json` unchanged after
   regeneration).
2. **`src/variants/ncube.js`** (new) — the family. Exports:
   - `NCUBE_SPEC_VERSION = 'ncube-v1'`, `NCUBE_MIN_DIMENSION = 3`,
     `NCUBE_MAX_DIMENSION` (integer constant fixed by the measurement step),
     `NCUBE_NAMES` (`3: 'cube'`, `4: 'tesseract'`, `5: 'penteract'`,
     `6: 'hexeract'`, `7: 'hepteract'`, `8: 'octeract'`, … as far as the bound needs).
   - `deriveNcube(seed, fixedDimension?)`, `describeNcube`, `prepareNcube`,
     `buildNcube`, `poseNcube`, `animateNcube`, `paintNcube`, `flashNcube` (one export
     per hook, like the square fixture).
   - `createNcubeVariant(dimension | null)` → frozen descriptor via `defineVariant`;
     `ncube` (seed-derived dimension, id `ncube`, label `N-cube`) and
     `ncubeVariants` — a frozen array `[ncube, ncube-3, …, ncube-<MAX>]` whose
     per-dimension ids are `ncube-<d>` with labels like `4-cube (tesseract)`.
3. **`src/variants/index.js`** — `createVariantRegistry([polyhedron, ...ncubeVariants],
   { defaultId: DEFAULT_VARIANT_ID })`; re-export the `ncube` module's public names
   from `./variants/index.js` only (no change to `src/index.js` exports — the
   thirteen-name public surface stays as is; discovery is via `listVariants()`).

### Derivation spec `ncube-v1` (frozen once shipped)

`seed → normalizeSeed → cyrb53 → mulberry32`, draw order:

1. `dimension = NCUBE_MIN_DIMENSION + floor(r() * (NCUBE_MAX_DIMENSION - NCUBE_MIN_DIMENSION + 1))`
   — **always drawn**, even for per-dimension ids, which then override the value. This
   makes `ncube-<d>` for a seed identical to `ncube` for that seed whenever the seed
   derives `d`, and keeps all downstream draws aligned across the family.
2. `finish = floor(r() * 3)` (same `FINISH_NAMES` semantics as polyhedron: shaded,
   two-tone, wireframe).
3. Higher-dimensional plane angles `theta[k]` for `k = 3 … NCUBE_MAX_DIMENSION - 1`,
   each `r() * TAU` — always `NCUBE_MAX_DIMENSION - 3` draws regardless of the
   instance's dimension (unused ones are ignored), so the count is fixed by the spec.
4. `ax, ay, az` — the 3D rest orientation, each `r() * TAU`.
5. `hue = PALETTE[hash % 12]`, `hue2 = PALETTE[(idx + 4) % 12]` (not PRNG draws).

`params` = `{ spec, seed, hash, dimension, finish, theta, ax, ay, az, hue, hue2 }`.
`describe(params)` → `"<d>-cube (<name>), <finish>"`, e.g. `4-cube (tesseract), wireframe`.

### Geometry and projection

- `geometry(params)` builds the d-cube once: vertices are all `±1` d-vectors (index bit
  `i` → coordinate `i`), edges join vertices differing in exactly one bit, 2-faces are
  the $\binom{d}{2}2^{d-2}$ squares (each pair of free axes × fixed values of the
  others). Returned object is frozen: `{ dimension, V, edges, faces }`.
- `paint` projects `d → 3` by applying, for each higher axis `k ≥ 3`, the rotation by
  `theta[k]` in the plane `(k mod 3, k)` and then a perspective projection from axis
  `k` with a fixed viewing distance (constant in the module, not seed-derived — the
  user did not select projection style as a trait), so higher cells nest visibly
  inside the outer cell (the classic tesseract look). The resulting 3D points are
  rotated by `(ax, ay, az)` via the same ZYX convention as `rot3`, uniformly scaled so
  the projected silhouette fits a radius of ~26 units around `(50, 50)` for every
  dimension, then projected to 2D with `F = 150` and emitted with `toFixed(1)` like the
  polyhedron.
- Finishes: `wireframe` → one `<path>` of all edges (`stroke-linecap/linejoin round`);
  `shaded` → 2-faces painted back-to-front by projected depth with the `ink(h, L)` ramp
  and `shadeFor(dark)` luminance from the projected-3D face normal;
  `two-tone` → same, alternating `hue`/`hue2` by the face's free-axis pair. Every finish
  must render for every supported dimension. `effects.sleeping`, `effects.lighten`,
  `effects.dx` and `effects.flash` are honored exactly as polyhedron's `renderInner`
  does (dimmer range while sleeping, `+lighten`, x-offset, hue mix).
- `prepare(params, { size })` returns `{ ...params, strokeWidth }` where stroke width
  scales down with dimension so dense wireframes stay legible at small sizes (concrete
  table decided by the Builder within `[1, 3.5]`; it is not identity-bearing).

### Static pose and motion hooks

- `pose(params, state)` returns the frozen `{ ax, ay, az }` from `params` for every
  state (no state-specific portrait; motion is `ncube-motion-system`'s job).
- `animate(pose, ctx)` returns `ctx.rest` when `ctx.state === 'settling'` and `pose`
  otherwise — the engine's dirty tracking then never repaints a static n-cube, and
  `settling → idle` completes on the first frame.
- `flash(params, state)` mirrors polyhedron (`receiving` → `{ hue, lighten: 26 }`,
  `done` → `{ hue: 145 }`, `error` → `{ hue: 4, shake: true }`, else `null`) so
  lifecycle feedback stays consistent across built-ins.

### Fixing `NCUBE_MAX_DIMENSION` by measurement

`scripts/measure-ncube.mjs` (new, unpublished — `scripts/` is outside `files`) renders,
for each candidate `d` from 3 up to 10 and for each finish, the static SVG at size 64
for the five golden seeds and reports per dimension: vertex/edge/face counts, maximum
static SVG byte size, median projected edge length in viewBox units, and the median
`paint()` wall time over 200 calls. The bound is the largest `d` for which **all** of
the following hold for every finish and seed:

- static SVG ≤ 32 KiB;
- median projected edge length ≥ 2.5 viewBox units (≈1.6 px at size 64);
- median `paint()` ≤ 5 ms in Node on the build machine (recorded, sanity bound).

The Builder commits the script output to `evidence/ncube-bounds.txt`, sets
`NCUBE_MAX_DIMENSION` to that `d`, registers exactly `ncube-3 … ncube-<MAX>`, and
documents the table and criteria in README `## Variants`. The constant is frozen with
the spec: raising it later changes the `dimension` draw and requires `ncube-v2`.

### Tests

- `test/ncube.test.js` (new): geometry counts for d=3..MAX match the closed forms;
  every vertex/edge index is in range; `deriveNcube` is deterministic and
  normalization-stable (`' Maya '` ≡ `'maya'`); per-dimension ids override only
  `dimension` (all other params equal to `ncube`'s for the same seed); `describe`
  strings; `BUILT_IN_VARIANTS.ids` = `['polyhedron', 'ncube', 'ncube-3', …,
  'ncube-<MAX>']`; `renderStaticSVG(seed, { variant: 'ncube-4' })` contains the
  aria label `4-cube (tesseract)` and fits inside the viewBox (all coordinates within
  `[0, 100]`); static markup equals the mounted markup at rest; reduced-motion mount
  queues no frames; `animate` returns the same object outside `settling` and
  `ctx.rest` inside it; JSDOM `setState` through every `STATES` entry never throws.
- `test/ncube-derivation-freeze.test.js` (new) + `test/fixtures/ncube-v1-identities.json`
  pinning `deriveNcube` output for the five golden seeds under `ncube` and under one
  fixed dimension.
- `test/helpers/golden.js` gains a `variant` option threaded into `renderStaticSVG` /
  `mountGlyph` opts (default unchanged), `scripts/generate-golden.mjs` writes
  `test/fixtures/golden-ncube-v1.json` (`variant: 'ncube'` and one per-dimension id)
  alongside the untouched `golden-v1.json`, and `test/golden-ncube.test.js` verifies it.
- `test/variants.test.js` L185/L250/L277 updated as described in Research.

### Types, docs, demo

- `index.d.ts`: add `export type BuiltInVariantId = 'polyhedron' | 'ncube' |
  \`ncube-${number}\``; change `GlyphOptions.variant` and `PrismiconProps.variant` to
  `BuiltInVariantId | (string & {})` (autocomplete for built-ins, still accepts custom
  ids for the later authoring feature); add `NcubeParams` and widen
  `GlyphHandle.params` to `GlyphParams | NcubeParams`.
- `README.md` `## Variants`: updated `listVariants()` output, an `### N-cube family`
  subsection with ids, `ncube` vs `ncube-<d>` semantics, the frozen `ncube-v1` draw
  order, the support table and bound criteria, and a note that motion arrives with
  `ncube-motion-system`.
- `demo/index.html`: a "Dimensions" gallery row mounting the same seed once per
  `ncube-<d>` id (ids taken from `listVariants()` filtered by `ncube-` prefix) with
  the dimension as caption, plus a seed input to re-render the row. The hero
  `<select>` picks up the new ids automatically. Verified by serving `demo/` on the
  slug port `local:3173` and screenshotting.

### Affected files

`src/variants/seed.js` (new), `src/variants/ncube.js` (new),
`src/variants/polyhedron.js` (import helpers only), `src/variants/index.js`,
`index.d.ts`, `README.md`, `demo/index.html`, `scripts/measure-ncube.mjs` (new),
`scripts/generate-golden.mjs`, `test/helpers/golden.js`, `test/variants.test.js`,
`test/ncube.test.js` (new), `test/ncube-derivation-freeze.test.js` (new),
`test/golden-ncube.test.js` (new), `test/fixtures/ncube-v1-identities.json` (new),
`test/fixtures/golden-ncube-v1.json` (new). Not touched: `src/core.js`, `src/react.js`,
`src/index.js`, `package.json`, `test/fixtures/golden-v1.json`.

## Risks

- **Accidental v1 change while extracting the hash/PRNG.** Mitigation: the move is a
  separate roadmap step gated by `golden-v1.json` regeneration diff being empty and the
  freeze test passing; `polyhedron.js` keeps exporting `normalizeSeed`.
- **Exponential geometry cost at high dimensions.** Mitigation: `NCUBE_MAX_DIMENSION`
  is fixed by the measurement script against explicit byte-size, legibility and paint
  time criteria, and dimensions above it are simply not registered (unknown id →
  `RangeError`, as the registry already guarantees).
- **Spec drift after shipping.** Mitigation: the `ncube-v1` draw order consumes a fixed
  number of PRNG values independent of the instance dimension, and the freeze test plus
  golden file pin identities; any later change to the bound or draws must be
  `ncube-v2`.
- **Type widening of `GlyphHandle.params`.** Consumers reading polyhedron-only fields
  from `handle.params` will need a narrowing check. Mitigation: documented in README
  and index.d.ts JSDoc; runtime behavior of the default variant is unchanged.
- **Demo requires an HTTP origin** (module imports from `file://` are blocked in
  Chromium). Mitigation: the roadmap serves `demo/` with `python3 -m http.server 3173`
  (slug `WEB_PORT`) for the browser check.
- **Concurrent delivery**: no open PRs at planning time; the Builder still merges
  `origin/main` before every push (policy §7).

## Out of scope

- Any n-cube motion, state-specific poses or transitions (`ncube-motion-system`).
- Public `defineVariant`/registry authoring APIs and new `src/index.js` exports
  (`custom-variant-authoring`).
- Authoring/validation tooling beyond the unpublished measurement script
  (`variant-build-tooling`).
- Changing polyhedron output, the default variant, or the frozen v1 spec.
- Changing `package.json` (no version bump; release is handled at ship time).
- Dimensions above the measured bound, or a runtime override of it.

## Acceptance checklist

- [ ] `npm test` exits 0 with `# fail 0` and at least 60 + the new n-cube tests, and
  `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures/golden-v1.json`
  exits 0 (v1 output byte-identical after the seed-helper extraction).
- [ ] `src/variants/seed.js` exports `cyrb53` and `mulberry32`, `polyhedron.js` imports
  them and contains no local definition (`grep -c "^function cyrb53\|^function mulberry32" src/variants/polyhedron.js` prints `0`).
- [ ] `listVariants().map(v => v.id)` equals `['polyhedron', 'ncube', 'ncube-3', …, 'ncube-<NCUBE_MAX_DIMENSION>']` with no gaps and `DEFAULT_VARIANT_ID` still `'polyhedron'` (asserted in `test/ncube.test.js`).
- [ ] For every `d` in `[3, NCUBE_MAX_DIMENSION]`, `buildNcube(d)` yields $2^d$ vertices, $d\,2^{d-1}$ edges and $\binom{d}{2}2^{d-2}$ faces (asserted in `test/ncube.test.js`).
- [ ] `deriveNcube` follows the documented `ncube-v1` draw order; `test/ncube-derivation-freeze.test.js` passes against `test/fixtures/ncube-v1-identities.json`, and `ncube-<d>` params equal `ncube` params for the same seed except `dimension`.
- [ ] `renderStaticSVG(seed, { variant })` for every n-cube id and every finish emits coordinates within `[0, 100]`, an aria label containing `<d>-cube`, and is identical to the mounted glyph's markup at rest and under reduced motion (asserted in `test/ncube.test.js` and `test/golden-ncube.test.js`).
- [ ] `animate` returns its input pose outside `settling` and `ctx.rest` inside it; a mounted n-cube stepped through all `STATES` never throws and paints only on state/flash changes (asserted in `test/ncube.test.js`).
- [ ] `evidence/ncube-bounds.txt` contains the measurement table and `NCUBE_MAX_DIMENSION` equals the largest dimension meeting all three criteria (≤ 32 KiB, median edge ≥ 2.5 units, median paint ≤ 5 ms); README documents the same table and criteria.
- [ ] `index.d.ts` declares `BuiltInVariantId`, `NcubeParams`, and the widened `variant` / `params` types; `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts 2>&1 | grep -cE "error TS"` prints `1` and that line names `'react'` (pre-existing TS7016 only).
- [ ] README `## Variants` documents the family (ids, `ncube` vs `ncube-<d>`, draw order, support table, motion deferred) and the section order `## React API`, `## Vanilla API`, `## Variants`, `## Derivation spec v1 (frozen)` is preserved.
- [ ] `demo/index.html` served at `local:3173` shows the hero `<select>` listing the n-cube ids and a "Dimensions" row with one glyph per `ncube-<d>`; screenshot committed under `evidence/`.
- [ ] `npm pack --dry-run` lists `src/variants/seed.js` and `src/variants/ncube.js` and nothing under `test/` or `scripts/`; `src/index.js` still exports exactly the thirteen names asserted in `test/variants.test.js`.
- [ ] `git diff --quiet origin/main -- src/core.js src/react.js src/index.js package.json test/fixtures/golden-v1.json` exits 0 at review time.
