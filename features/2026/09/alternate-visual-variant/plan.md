# Alternate visual variant (Orbit)

## Problem

Every built-in variant so far is a projected polyhedron: the default `polyhedron`
renders a shaded 3D solid and the `ncube` family renders wireframe/shaded hypercubes
projected onto a 3D plane ([src/variants/polyhedron.js](../../../../src/variants/polyhedron.js),
[src/variants/ncube.js](../../../../src/variants/ncube.js)). The variant architecture
(registry, renderer hooks, authoring, tooling) has only ever carried that one visual
language, so it is unproven that the shared contracts support a genuinely different
design. The initiative's definition of done requires "at least one built-in visual
family distinct from n-cubes".

This feature ships **Orbit**: a flat, 2D-forward variant of concentric orbital rings
with seed-placed nodes and a core mark — no perspective projection at all, for maximum
contrast with both the shaded 3D polyhedra and the wireframe n-cubes. It is registered
as the single parameterized id `orbit` (like the bare `ncube`), whose seed derivation
picks ring and node counts, with the full lifecycle motion set (distinct motion per
state, settling, flash) and a lightweight committed benchmark.

It implements the `### alternate-visual-variant` member of the
[scalable-icon-variants breakdown](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
(initiative `scalable-icon-variants`, wave 5; requires `variant-build-tooling`, which
is `complete`). It is the first variant added end-to-end through the maintainer recipe
documented in [README.md](../../../../README.md#L418-L458) `## Adding a variant
(maintainers)`, which is itself the tooling deliverable of the required predecessor.

Member brief (verbatim): *Include visual design beyond the initial n-cube family.*
Member summary: *Ship a second visually distinct built-in variant to prove the
architecture is not coupled to projected n-cubes and to establish broader visual
design guidance.*

User-visible effect: `mountGlyph(el, seed, { variant: 'orbit', state: 'working' })`
and `<Prismicon seed="maya" variant="orbit" state="working" />` render a flat
orbital mark — concentric rings carrying seed-placed nodes around a core — that
counter-rotates its rings while working, sways, pulses, bursts on send/receive and
settles back to its seed rest pose; `renderStaticSVG`, SSR and
`prefers-reduced-motion` produce the deterministic static portrait. Callers that
omit `variant` are untouched.

## Decisions

Clarifying questions asked on 2026-09-12 and the user's answers (verbatim):

1. **Visual design direction** → **Orbit** — *flat, concentric orbital rings with
   seed-placed nodes and a core mark; 2D-forward, no perspective projection at all
   (maximum contrast with both the shaded 3D polyhedra and the wireframe n-cubes).*
2. **Registration granularity** → **Single parameterized id** (*`orbit`, like the
   bare `ncube`) whose seed derivation picks ring/node counts.*
3. **Motion scope** → **Full lifecycle motion set** — *distinct motion per state,
   settling, flash.*
4. **Variant id and label** → *id `orbit`, label "Orbit". Must match
   VARIANT_ID_PATTERN; lands in BuiltInVariantId in index.d.ts, README `## Variants`,
   a new `golden-orbit-v1.json` fixture via `fixtureFor` in test/helpers/golden.js,
   and the demo.*
5. **Performance gate** → **Lightweight benchmark** — *a measure script like
   scripts/measure-ncube.mjs with committed evidence.*

## Research

Skills consulted: modern-javascript-patterns (pure hook functions, `const` by default,
frozen pose/geometry objects, spread over mutation, no shared mutable state in
`animate`); vercel-react-best-practices (reviewed for the React regression test:
[src/react.js](../../../../src/react.js) renders the variant's static portrait on the
server and mounts once on hydrate without remounting on `state` changes, so no
component change is warranted — only a test is added).

### The recipe this feature follows

[README.md](../../../../README.md#L418-L458) `## Adding a variant (maintainers)`
(the `variant-build-tooling` deliverable) prescribes exactly: a
`src/variants/<id>.js` module with `defineVariant`, registration in
`BUILT_IN_VARIANTS` in [src/variants/index.js](../../../../src/variants/index.js),
a `fixtureFor` row in [test/helpers/golden.js](../../../../test/helpers/golden.js#L8-L17)
for a new family file, `node scripts/generate-golden.mjs`, a `BuiltInVariantId`
entry in [index.d.ts](../../../../index.d.ts#L34-L38), README docs, and
`npm run check:variants`. This plan executes that recipe and adds the motion,
derivation-freeze and benchmark rigor established by the n-cube family.

### Contracts the variant must fit

- [src/variants/registry.js](../../../../src/variants/registry.js#L17-L45) documents
  the eight hooks (`derive → describe → prepare → geometry → pose → animate → paint →
  flash`), the `ctx` (`params, state, dt, t, transientT, rest`) and `effects`
  (`dark, sleeping, dx, lighten, flash`) shapes; `VARIANT_ID_PATTERN =
  /^[a-z][a-z0-9-]*$/` accepts `orbit`. Pose shape is variant-private.
- [src/core.js](../../../../src/core.js) engine semantics (as established in the
  ncube-motion plan): repaint only when `animate` returns a new object or a flash is
  active; `settling → idle` fires **only** when `animate` returns `ctx.rest` by
  identity; transients switch to `settling` after `transientT > 0.4`; under reduced
  motion `setState` paints `inst.rest` directly and queues no frames. `orbit` motion
  must follow the same return-by-identity rules as
  [animateNcube](../../../../src/variants/ncube.js#L200-L290).
- [src/variants/validate.js](../../../../src/variants/validate.js) probes determinism
  and SSR safety over `PROBE_STATES` with `ANIMATE_DT = 1/60`; the orbit hooks must
  be pure functions that never touch browser globals during static rendering.
- [src/variants/seed.js](../../../../src/variants/seed.js) exports `cyrb53` /
  `mulberry32`; [src/variants/polyhedron.js](../../../../src/variants/polyhedron.js)
  already exports `PALETTE`, `FINISH_NAMES`, `normalizeSeed`, `angDiff`, `wrapAngle`
  — orbit reuses all of them; no polyhedron change is needed.
- `prepareNcube`'s motion-traits precedent
  ([src/variants/ncube.js](../../../../src/variants/ncube.js#L160-L191)): per-seed
  motion traits are derived from disjoint bit ranges of `params.hash` in `prepare`,
  with **no new PRNG draws**, so `derive` output and the static portrait stay frozen
  under the spec. Orbit adopts the same rule.

### Registration and the pinned surfaces that must move

- [src/variants/index.js](../../../../src/variants/index.js#L1-L29): add
  `orbit` to `BUILT_IN_VARIANTS` **after** the n-cube ids, so
  `listVariants()` yields `['polyhedron', 'ncube', 'ncube-3'…'ncube-6', 'orbit']`.
  Root exports in [src/index.js](../../../../src/index.js) stay pinned to the
  machinery names (adding one fails the `exports` check in
  [scripts/check-variants.mjs](../../../../scripts/check-variants.mjs#L28-L47));
  `orbit` is exported from `src/variants/index.js` like `ncube`.
- Tests that pin the registered id list must gain `'orbit'`:
  [test/variants.test.js](../../../../test/variants.test.js#L200) and
  [L301](../../../../test/variants.test.js#L301),
  [test/ncube.test.js](../../../../test/ncube.test.js#L602-L619) (`BUILT_IN_VARIANTS.ids`
  deep-equal). [test/authoring.test.js](../../../../test/authoring.test.js#L49) reads
  the ids dynamically and needs no change; the `fixtureFor`-filtered check in
  [test/golden-ncube.test.js](../../../../test/golden-ncube.test.js#L15-L21) is
  unaffected as long as `orbit` maps to its own family file.
- [test/helpers/golden.js](../../../../test/helpers/golden.js#L8-L17): add the row
  `{ test: (id) => id === 'orbit', file: 'golden-orbit-v1.json' }`;
  [scripts/generate-golden.mjs](../../../../scripts/generate-golden.mjs) iterates
  every registered id automatically, so it writes
  `test/fixtures/golden-orbit-v1.json` keyed `{ orbit: { static, mounted } }`
  without touching `golden-v1.json` or `golden-ncube-v1.json` (verified by diff).
- [scripts/check-variants.mjs](../../../../scripts/check-variants.mjs): `contract`
  runs `validateVariant` on the new descriptor and `goldens` requires the new
  fixture entry; both are covered by running the maintainer gate.

### Benchmark precedent

[scripts/measure-ncube.mjs](../../../../scripts/measure-ncube.mjs) is the template:
static table (bytes, median `paint()` over 200 calls, five golden seeds at size 64)
plus a frame table simulating the engine loop (60 working frames at `dt = 1/30`,
12 `sending` frames, settling until `ctx.rest`; median/p95 `animate + paint`,
settling frame count) with a `frame gate: pass|fail` line. Orbit gets a sibling
`scripts/measure-orbit.mjs` (not published — `scripts/` is outside
[package.json](../../../../package.json) `files`) with output committed to
`evidence/orbit-benchmark.txt`. Flat 2D painting of ≤ 4 rings + ≤ 16 nodes + a core
mark is far cheaper than a 6-cube, so the same gates apply: median `animate + paint`
≤ 2 ms, p95 ≤ 4 ms, settling ≤ 60 frames, median static `paint()` ≤ 5 ms, static
SVG ≤ 32768 bytes.

### Types, docs, demo

- [index.d.ts](../../../../index.d.ts#L34-L38): `BuiltInVariantId` gains `'orbit'`;
  a new `OrbitParams` interface joins the `GlyphHandle.params` union
  ([L84-L95](../../../../index.d.ts#L84-L95)); the narrowing JSDoc mentions
  `'ringCount' in params`.
- [README.md](../../../../README.md#L108-L147) `## Variants`: the intro names orbit
  as the third built-in, the `listVariants()` example gains the orbit row, the
  narrowing bullet mentions `'ringCount'`, and a new `### Orbit` subsection after
  `### N-cube family` documents the design, the frozen `orbit-v1` draw order, the
  per-state motion model, and the benchmark evidence.
- [demo/index.html](../../../../demo/index.html): the variant `<select>` is driven
  by `listVariants()` so `orbit` appears automatically; this feature adds an "Orbit"
  lifecycle row (seed input + `STATES` button strip calling `setState`, mirroring
  the "Lifecycle (n-cube family)" row at
  [demo/index.html](../../../../demo/index.html#L150-L190)) so the full motion set
  is visible in a browser.

### Lint baseline and overlap decision (policy §5)

- AGENTS.md declares `Lint: none`; the maintainer gate is `npm test` plus
  `npm run check:variants` (variant contract, exports, `index.d.ts` typecheck,
  `npm pack` contents, golden freshness).
- Baseline run on 2026-09-12 at `origin/main` `f60a4c0` in this planning worktree:
  `npm run lint` → no such script (none declared); `npm test` → exit 0,
  `# tests 132`, `# pass 132`, `# fail 0`; `npm run check:variants` → exit 0
  (`✓` for contract, exports, types, pack, goldens).
- Findings: none. Overlap: not applicable. The gate for this delivery is therefore
  the **full** `npm test` run (never a changed-files subset) plus `npm run
  check:variants` and the additional machine checks in the acceptance checklist
  (other families' fixtures unchanged after regeneration, pinned-surface updates,
  `npm pack` file list).
- Concurrent deliveries: `gh pr list --state open --json number,headRefName`
  returned `[]` on 2026-09-12; `feature/alternate-visual-variant` exists neither
  locally nor on `origin` (`agento.mjs find alternate-visual-variant` →
  `status: missing`). No overlapping branch exists.

## Approach

### Visual design — flat orbits, no projection

Everything is computed directly in the 100×100 viewBox; there is no 3D math, no
perspective focal length, no `rot3`. Around center `(50, 50)`:

- **Rings**: `ringCount` (2–4, seed-derived) concentric circles, radii spread evenly
  up to 26 viewBox units (the shared silhouette bound used by both existing
  variants), stroked in the seed's `hue`, unfilled.
- **Nodes**: per ring, `nodeCounts[r]` (1–4, seed-derived) filled dots on the ring at
  seed angles, alternating `hue`/`hue2` by ring parity.
- **Core mark**: one of three seed-derived center marks — filled dot, plus, or
  diamond — scaled by the pose's `coreScale` (breathing/pulse motion).
- **Effects**: `paint` honors `effects.dark` (lightness table like `shadeFor` in
  `paintNcube`), `effects.sleeping` (dimmed), `effects.dx` (error shake offset),
  `effects.lighten` and `effects.flash` (`lerpHue` toward the flash hue), mirroring
  the established `ink()` pattern so accessibility/dimming semantics match the other
  variants. Coordinates are emitted with `toFixed(1)`; every coordinate stays in
  `[0, 100]`.

### Derivation spec `orbit-v1` (frozen)

`seed → normalizeSeed → cyrb53 → mulberry32` (the shared
[src/variants/seed.js](../../../../src/variants/seed.js) pipeline). Like the n-cube
spec, **every draw is made regardless of the derived ring count** so the draw order
never depends on earlier values:

1. `ringCount = 2 + floor(r() * 3)` (2–4; `ORBIT_MAX_RINGS = 4`).
2. `nodeCounts[r]` for `r` in 0..3: `1 + floor(r() * 4)` (`ORBIT_MAX_NODES = 4`;
   always 4 draws; only the first `ringCount` are used).
3. `nodeAngles[r * 4 + n]` for 16 draws: `r() * TAU` — rest angle of node `n` on
   ring `r` (only the first `nodeCounts[r]` per ring are used).
4. `coreMark = floor(r() * 3)` (0 = dot, 1 = plus, 2 = diamond).
5. `hue = PALETTE[hash % 12]`, `hue2 = PALETTE[(idx + 4) % 12]` (not PRNG draws).

`deriveOrbit` returns frozen
`{ spec: 'orbit-v1', seed, hash, ringCount, nodeCounts, nodeAngles, coreMark, hue, hue2 }`.
Pinned by a new `test/fixtures/orbit-v1-identities.json` +
`test/orbit-derivation-freeze.test.js` (mirroring the ncube identity fixture).

`describeOrbit` produces the aria anatomy, e.g.
`"3-ring orbit, 9 nodes, diamond core"`.

### Geometry, prepare, pose

- `buildOrbit(params)` (the `geometry` hook) returns frozen
  `{ radii: number[], slots: number[][] }` — radii `26 * (r + 1) / ringCount` and
  per-ring node angle arrays sliced from `params.nodeAngles`.
- `prepareOrbit(params, { size })` returns `{ ...params, strokeWidth, dir, ringSpeeds, phase }`:
  `strokeWidth` 1.6 (viewBox units), and motion traits from disjoint bit ranges of
  `params.hash` with **no new PRNG draws** (spec stays `orbit-v1`; constants are
  documented `ORBIT_MOTION_*` tunables):

  | Field | Derivation | Meaning |
  |---|---|---|
  | `dir` | `hash % 2 === 0 ? 1 : -1` | Base sense of rotation |
  | `ringSpeeds[r]` | `dir * (-1)^r * (0.5 + byte_r / 255 * 0.5)` rad/s, `byte_r` = bits `1 + 8r … 8 + 8r` of `hash` | Per-ring working speed; rings counter-rotate |
  | `phase` | `(bits 33–40 of hash) / 255 * TAU` | Sway/pulse phase offset |

- `poseOrbit(params, state)` returns the same frozen rest pose
  `{ offsets: [0 × ringCount], coreScale: 1 }` for **every** state — motion always
  starts from rest, so the first mounted frame equals the static portrait and
  reduced-motion output is the static markup.

### `animateOrbit(pose, ctx)` per engine state

Let `k(rate) = Math.min(1, dt * rate)`, easing via the exported
`angDiff`/`wrapAngle` from `polyhedron.js`; every moving frame returns a **new**
frozen object and never mutates its input.

- `idle`, `done`, `error` → return `pose` unchanged (the engine drives the flash).
- `working` → `offsets[r] += ringSpeeds[r] * dt` (wrapped), so adjacent rings
  counter-rotate; `coreScale` eases with `k(3)` toward
  `1 + sin(t * 1.2 + phase) * 0.06` (gentle breathing).
- `waiting` → each ring's offset eases with `k(3.5)` toward
  `rest + sin(t * 0.8 + phase + r * 1.7) * 0.04` (soft per-ring sway); `coreScale → 1`.
- `thinking` → the outermost ring wobbles toward `sin(t * 0.6 + phase) * 0.08`,
  inner rings ease to rest; `coreScale` pulses toward
  `1 + max(0, sin(t * 0.5 + phase)) * 0.1`.
- `sleeping` → offsets ease to rest with `k(1.2)`; `coreScale` eases toward
  `0.85 + sin(t * 0.25 + phase) * 0.03` (slow, small breathing; the engine dims).
- `sending` / `receiving` → burst on the outermost ring
  `± (0.5 + |ringSpeeds[top]|) * 3.2 * exp(−transientT * 7) * dt`, `+` for sending,
  `−` for receiving; `coreScale` eases to 1 with `k(4)`.
- `settling` → every offset eases toward rest with `k(4.5)` through `angDiff` and
  `coreScale → 1`; once all `|angDiff| < 0.015` and `|coreScale − 1| < 0.01`,
  return **`ctx.rest` itself** so the engine flips to `idle`.

`flashOrbit` mirrors `flashNcube`: `receiving → { hue, lighten: 26 }`,
`done → { hue: 145 }`, `error → { hue: 4, shake: true }`, otherwise `null`.

The Builder may adjust `ORBIT_MOTION_*` magnitudes within ±30 % for legibility as
long as the planned tests pass and the README matches the code.

### Tests and fixtures

- **New** `test/orbit.test.js`: derivation determinism and frozen params; draw-order
  independence (two seeds differing only after the `ringCount` draw keep the earlier
  draws — asserted via a fixture-free property check on the first draws);
  `describeOrbit` format; `buildOrbit` radii/slots frozen and bounded; rest pose
  identical for `[...STATES, 'settling']`; static markup equals mounted markup at
  rest; reduced motion queues no frames and equals static markup in every state;
  `working` advances each ring monotonically at `ringSpeeds[r] * dt` with adjacent
  rings counter-rotating; `waiting`/`thinking`/`sleeping` change the pose on the
  first frame; `sending`/`receiving` burst the outer ring in opposite directions;
  `settling` from a perturbed pose returns `ctx.rest` by identity within 60 frames;
  `idle`/`done`/`error` return the input object; `animate` never mutates a frozen
  input; 60 working frames keep every emitted coordinate in `[0, 100]`; `paint`
  reflects `dark`/`lighten`/`flash` effects; `flashOrbit` mapping;
  `validateVariant(orbit)` passes.
- **New** `test/orbit-derivation-freeze.test.js` + `test/fixtures/orbit-v1-identities.json`
  pinning `deriveOrbit` output for the five golden seeds.
- **New** `test/golden-orbit.test.js` mirroring
  [test/golden-ncube.test.js](../../../../test/golden-ncube.test.js) against
  `golden-orbit-v1.json` (registry-filtered by `fixtureFor`).
- **Edit** `test/helpers/golden.js`: add the orbit row to `FAMILY_FIXTURES`.
- **Edit** pinned id lists in `test/variants.test.js` (two assertions) and
  `test/ncube.test.js` (one assertion) to append `'orbit'`.
- **Edit** `test/react-variant.test.js`: add "hydration of an animated orbit has no
  recoverable errors and rotates after frames" (SSR `variant: 'orbit', state:
  'working'` equals `renderStaticSVG`; hydrate with a fake rAF queue; zero
  recoverable errors; `<g>` innerHTML differs after frames), mirroring the animated
  n-cube case. `src/react.js` itself is untouched.
- **Generate** `test/fixtures/golden-orbit-v1.json` via
  `node scripts/generate-golden.mjs`; the diff must be confined to the new file
  (`git diff --quiet -- test/fixtures/golden-v1.json
  test/fixtures/golden-ncube-v1.json test/fixtures/ncube-v1-identities.json` exits 0).

### Benchmark

**New** `scripts/measure-orbit.mjs` (unpublished) modeled on
`scripts/measure-ncube.mjs`: a static table (five golden seeds, size 64: SVG bytes,
ring/node counts, median `paint()` over 200 calls) gated at ≤ 32768 bytes and ≤ 5 ms
median, and a frame table (60 working frames at `dt = 1/30`, 12 `sending` frames,
settling until `ctx.rest`; median and p95 `animate + paint`, settling frame count)
gated at median ≤ 2 ms, p95 ≤ 4 ms, settling ≤ 60 frames, printing
`static gate: pass|fail` and `frame gate: pass|fail` and exiting nonzero on failure.
Output committed to `evidence/orbit-benchmark.txt`.

### Types, docs, demo

- `index.d.ts`: `BuiltInVariantId` becomes
  `'polyhedron' | 'ncube' | 'orbit' | ` + `` `ncube-${number}` ``; new
  `OrbitParams` (identity fields plus optional readonly prepared fields
  `strokeWidth`, `dir`, `ringSpeeds`, `phase`, with the same "prepared, not derived"
  JSDoc convention as `NcubeParams`); `GlyphHandle.params` union gains
  `OrbitParams`; narrowing JSDoc mentions `'ringCount' in params`.
- `README.md`: `## Variants` intro and `listVariants()` example gain `orbit`; the
  narrowing bullet mentions `'ringCount'`; new `### Orbit` subsection (design
  summary, frozen `orbit-v1` draw order, per-state motion table, "traits without new
  draws" note, reduced-motion behavior, benchmark reference with the measured median
  frame value from `evidence/orbit-benchmark.txt`).
- `demo/index.html`: new "Orbit" section with a seed input and a `STATES` button
  strip mounting `orbit` glyphs at size 72 (mirroring the n-cube lifecycle row);
  verified in a browser at `local:3179` (per-slug port from
  `agento.mjs ports alternate-visual-variant`) with screenshots committed under
  `evidence/`.

### Affected files

New: `src/variants/orbit.js`, `test/orbit.test.js`,
`test/orbit-derivation-freeze.test.js`, `test/golden-orbit.test.js`,
`test/fixtures/golden-orbit-v1.json`, `test/fixtures/orbit-v1-identities.json`,
`scripts/measure-orbit.mjs`, `features/2026/09/alternate-visual-variant/evidence/*`.
Edited: `src/variants/index.js`, `test/helpers/golden.js`, `test/variants.test.js`,
`test/ncube.test.js`, `test/react-variant.test.js`, `index.d.ts`, `README.md`,
`demo/index.html`. Not touched: `src/core.js`, `src/react.js`, `src/index.js`,
`src/variants/registry.js`, `src/variants/validate.js`, `src/variants/seed.js`,
`src/variants/polyhedron.js`, `src/variants/ncube.js`, `package.json`,
`test/fixtures/golden-v1.json`, `test/fixtures/golden-ncube-v1.json`,
`test/fixtures/ncube-v1-identities.json`.

## Risks

- **Pinned registry-order assertions break.** Three tests deep-equal the registered
  id list. Mitigation: roadmap updates them in the same step as registration, and
  the full `npm test` gate runs immediately after.
- **Golden regeneration touches other families.** `generate-golden.mjs` re-captures
  every registered id; a renderer-side accident would silently rewrite v1/ncube
  goldens. Mitigation: acceptance requires `git diff --quiet` on
  `golden-v1.json`, `golden-ncube-v1.json` and `ncube-v1-identities.json` after
  every regeneration; a stale-`goldens` failure without a spec bump is a regression,
  per the README's spec-bump rule.
- **`settling` never reaches `ctx.rest` by identity** (engine would repaint forever).
  Mitigation: explicit unit test from a perturbed pose within 60 frames, the mounted
  "settles back to rest markup" test, and the benchmark's settling-frame count.
- **Spec draw order accidentally depends on derived values** (e.g. drawing only
  `ringCount` node-count values), making future bumps incompatible. Mitigation: the
  fixed 22-draw order is documented in the module header and README, pinned by the
  identity fixture, and covered by a draw-order independence test.
- **Flat design looks too close to the status ring or lacks contrast in dark mode.**
  Mitigation: outermost radius is capped at the shared 26-unit silhouette bound,
  the dark-mode lightness table mirrors the proven `shadeFor` values, and the demo
  row is eyeballed in both color schemes with committed screenshots.
- **Benchmark drift between machines.** Mitigation: gates are the same conservative
  budgets the n-cube family already passes by >10× margin; the committed evidence
  file records the planning machine's numbers and the README cites that run.
- **Concurrent delivery**: no open PRs at planning time (`gh pr list --state open`
  → `[]` on 2026-09-12), so no file overlap exists; the Builder still integrates
  `origin/main` by merge before every push (policy §7).

## Out of scope

- Changes to `src/core.js`, `src/react.js`, `src/index.js`, the registry/validate
  machinery, `src/variants/polyhedron.js`, `src/variants/ncube.js`, or
  `package.json` (no version bump; release is handled at ship time).
- Any change to v1 or ncube-v1 identities, fixtures, or goldens.
- Multiple registered orbit ids (e.g. `orbit-3`); ring/node counts are seed-derived
  under the single `orbit` id (Decision 2).
- CSS/SMIL-based animation, interactivity, or a configurable theme API.
- New root exports from `src/index.js` (pinned surface stays as is).
- Initiative-level artifacts or re-planning of other members.

## Acceptance checklist

- [ ] `npm test` exits 0 with `# fail 0` and at least 132 + the new orbit tests;
  `npm run check:variants` exits 0 (contract, exports, types, pack, goldens).
- [ ] `listVariants()` returns ids `['polyhedron', 'ncube', 'ncube-3', 'ncube-4',
  'ncube-5', 'ncube-6', 'orbit']` with `{ id: 'orbit', label: 'Orbit', spec:
  'orbit-v1' }` last; `Object.keys(await import('./src/index.js')).sort()` is
  unchanged from `origin/main` (18 pinned names).
- [ ] `deriveOrbit` output for the five golden seeds is pinned by
  `test/fixtures/orbit-v1-identities.json` and `test/orbit-derivation-freeze.test.js`
  passes; the module header documents the frozen 22-draw `orbit-v1` order in which
  every draw is made regardless of `ringCount`.
- [ ] After every `node scripts/generate-golden.mjs` run,
  `git diff --quiet -- test/fixtures/golden-v1.json
  test/fixtures/golden-ncube-v1.json test/fixtures/ncube-v1-identities.json`
  exits 0 and `test/fixtures/golden-orbit-v1.json` exists with a single `orbit` key
  (asserted by `test/golden-orbit.test.js` and the `goldens` check).
- [ ] `poseOrbit(p, state)` returns a frozen `{ offsets, coreScale: 1 }` identical
  for every state in `[...STATES, 'settling']`; static markup equals mounted markup
  at rest and reduced-motion output equals static markup in every state (asserted in
  `test/orbit.test.js` and by the golden static entries).
- [ ] In `working`, each ring's offset advances by `ringSpeeds[r] * dt` with
  adjacent rings counter-rotating; `waiting`, `thinking`, `sleeping`, `sending`,
  `receiving` each return a new object differing on the first frame; `sending` and
  `receiving` move the outermost ring in opposite directions; `idle`, `done`,
  `error` return the input object; no state mutates its input (asserted in
  `test/orbit.test.js`).
- [ ] `settling` from a perturbed pose returns `ctx.rest` by identity within 60
  frames at `dt = 1/30`, and a mounted orbit driven through every `STATES` entry
  ends at the exact rest markup (asserted in `test/orbit.test.js`); 60 working
  frames keep every emitted coordinate within `[0, 100]`.
- [ ] `validateVariant(orbit)` passes the determinism and SSR probes (asserted in
  `test/orbit.test.js` and by the `contract` check).
- [ ] `test/react-variant.test.js` "hydration of an animated orbit" passes (SSR
  markup equals `renderStaticSVG`, zero recoverable errors, `<g>` innerHTML changes
  after frames) and `git diff --quiet origin/main -- src/react.js` exits 0.
- [ ] `evidence/orbit-benchmark.txt` (output of `node scripts/measure-orbit.mjs`)
  shows `static gate: pass` (≤ 32768 bytes, median `paint()` ≤ 5 ms) and
  `frame gate: pass` (median `animate + paint` ≤ 2 ms, p95 ≤ 4 ms, settling ≤ 60
  frames), and the README `### Orbit` section cites the measured median frame value.
- [ ] `index.d.ts` declares `'orbit'` in `BuiltInVariantId`, the `OrbitParams`
  interface, and the widened `GlyphHandle.params` union; the `types` check
  (`tsc --noEmit --strict` over `index.d.ts`) exits 0 via `npm run check:variants`.
- [ ] README `## Variants` lists `orbit` (intro, `listVariants()` example, narrowing
  bullet) and a `### Orbit` subsection documents the design, the frozen `orbit-v1`
  draw order, the per-state motion model, the no-new-draws trait rule and
  reduced-motion behavior; `grep -n "^## " README.md` shows the existing section
  order unchanged.
- [ ] `demo/index.html` served at `local:3179` shows an "Orbit" row with a seed
  input and state button strip; clicking `working`, `thinking` and `sending`
  visibly animates the glyph, the page stays responsive, and screenshots are
  committed under `evidence/`.
- [ ] `git diff --quiet origin/main -- src/core.js src/react.js src/index.js
  src/variants/registry.js src/variants/validate.js src/variants/seed.js
  src/variants/polyhedron.js src/variants/ncube.js package.json
  test/fixtures/golden-v1.json test/fixtures/golden-ncube-v1.json
  test/fixtures/ncube-v1-identities.json` exits 0 at review time, and
  `npm pack --dry-run` lists no files under `test/`, `scripts/`, `demo/`, or
  `features/`.
