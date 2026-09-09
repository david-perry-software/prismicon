# Variant renderer integration

## Problem

prismicon can *name* a variant since wave 1
([src/variants/registry.js](../../../../src/variants/registry.js),
[src/variants/index.js](../../../../src/variants/index.js)), but nothing *renders*
through it: [src/core.js](../../../../src/core.js) still hard-codes the polyhedron
geometry, its per-state motion, and its painter inside `renderStaticSVG` (lines
257–268) and `mountGlyph` (lines 410–486), and the `variant` option key reserved by the
registry is never read. A consumer who writes `renderStaticSVG(seed, { variant })` today
gets the polyhedron regardless, and every later member of the initiative
(`ncube-geometry-family`, `custom-variant-authoring`, `react-variant-selection`) would
have to reimplement the state rings, aria-labels, reduced-motion handling, and the
shared rAF engine.

This feature implements the `### variant-renderer-integration` member block of
[scalable-icon-variants/breakdown.md](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
(wave 2; requires `variant-registry-contract`, which is `status: complete`). Brief:
*"Make multiple package styles usable per icon through the core JavaScript API."*
Summary: route static SVG rendering, mounted glyph rendering, lifecycle states,
accessibility, and reduced-motion handling through the selected variant contract.

User-visible effect: `renderStaticSVG(seed, { variant: 'polyhedron' })` and
`mountGlyph(el, seed, { variant })` select a registered variant per icon; an unknown id
throws `RangeError`; `listVariants()` and `DEFAULT_VARIANT_ID` are exported for
discovery; the returned handle reports `handle.variant`; the demo page gains a variant
selector. Callers that omit `variant` get **byte-identical** output to today — proven by
golden fixtures captured from the current code before any refactor.

## Decisions

Clarifying questions were asked against the member brief; answers are verbatim.

1. **Public surface.** Wave 1 kept the registry internal. Which of these should
   `prismicon` expose this wave — (a) only a `variant?: string` key on `GlyphOptions`
   read by the existing `renderStaticSVG`/`mountGlyph`; (b) (a) plus read-only discovery
   (`listVariants()`, `DEFAULT_VARIANT_ID`, `getVariant(id)`); (c) (b) plus
   `defineVariant`/`createVariantRegistry` so consumers can register their own now?

   > Whatever is best longterm

   Planner's resolution: **(b) minus `getVariant`.** Export `variant?: string` on
   `GlyphOptions`, `handle.variant`, `DEFAULT_VARIANT_ID`, and `listVariants()` returning
   frozen `{ id, label, spec }` records. The descriptor's hook shape stays internal:
   exposing `getVariant`/`defineVariant` now would freeze the hook contract before a
   second real variant (`ncube-geometry-family`) has validated it; that is exactly what
   `custom-variant-authoring` (wave 3) is for. Discovery metadata is stable and lets the
   demo and consumer UIs build selectors without touching descriptors.

2. **Shared infrastructure vs. per-variant hooks.** Keep whole-pipeline hooks
   (`renderStatic`/`mount`) and only add dispatch, or refactor `src/core.js` so the state
   ring, aria/title, reduced motion, and animation scheduling become shared
   infrastructure and variants supply narrower hooks?

   > Whatever is best longterm

   Planner's resolution: **refactor into shared infrastructure with narrow hooks.** The
   breakdown requires "scheduling and state transitions in shared infrastructure with
   bounded per-instance work" (Risks) and that custom variants get accessibility and
   reduced motion as "mandatory parts of the extension contract"; whole-pipeline hooks
   make both impossible. The wave-1 descriptor's `renderStatic`/`mount` hooks are
   replaced by `prepare`, `geometry`, `pose`, `animate`, `paint` (see Approach). The
   wave-1 plan anticipated this: "Later waves add fields through `defineVariant()`
   validation, which is the single place the shape is enforced."

3. **Proving dispatch.** Is a test-only fixture variant acceptable as the proof that a
   non-default variant renders, mounts, changes state, and honours reduced motion, or
   do you want a tiny shipped second variant?

   > Yes, a test is ok

   Resolution: a deterministic `square` variant lives in `test/fixtures/` and is never
   shipped (`package.json` `files` excludes `test/`).

4. **Handle/params exposure.** Should `GlyphHandle` expose the resolved variant id and
   should the SVG carry a `data-variant` attribute (which would change default bytes
   unless emitted only for non-default variants)?

   > Whatever is best longterm

   Planner's resolution: **`handle.variant` yes; `data-variant` no.** The id on the
   handle is free, needed by `react-variant-selection` for effect keys, and changes no
   markup. A `data-variant` attribute would either alter the frozen default bytes or be
   emitted inconsistently; byte-identical default output is the strongest regression
   guard available for this refactor, so it stays untouched. A consumer-facing attribute
   can be added later by whichever wave has a concrete need.

5. **Demo and browser verification.** Should `demo/index.html` gain a variant selector
   this wave, or is the Node/JSDOM suite the only verification?

   > Yes, lets get a super basic demo setup

   Resolution: a `<select>` populated from `listVariants()` that remounts the hero glyph
   with the chosen `variant`; verified in a real browser on `local:3128`.

## Research

Skills consulted: modern-javascript-patterns, vercel-react-best-practices

**Lint baseline (policy §5).** [AGENTS.md](../../../../AGENTS.md) declares `Lint: none`,
`Typecheck: none`; the only verification command is `npm test`
(`node --test test/*.test.js`, [package.json](../../../../package.json) `scripts`). No
ESLint/Prettier/tsconfig/CI exists. Recorded on this worktree at `origin/main`
(`ec81fac`, 2026-09-08):

- Before `npm ci` (fresh worktree, no `node_modules`): `npm test` exit 1 — 21 tests,
  20 pass, 1 fail: `test/prismicon.test.js` failed to load with `ERR_MODULE_NOT_FOUND:
  Cannot find package 'jsdom'`. Environment, not a code defect.
- After `npm ci` (exit 0): `npm test` exit 0 — **32 tests, 32 pass, 0 fail** (1 in
  `test/derivation-freeze.test.js`, 12 in `test/prismicon.test.js`, 19 in
  `test/variants.test.js`).

Overlap decision: there are no lint findings, so no cleanup and no scoped gate; the
complete gate is the full `npm test` run (32 baseline + every new test) at `# fail 0`,
required by the roadmap and acceptance checklist.

**Codebase findings** (evidence: file paths and lines at `ec81fac`).

- *Pipeline seams already exist.* `renderInner(p, geo, o, opts)`
  ([src/core.js](../../../../src/core.js#L186-L233)) is the per-frame painter and the
  single function called from three places: `renderStaticSVG` (L264), the first paint
  and reduced-motion `setState` in `mountGlyph` (L435, L456), and the engine `step`
  (L388). It takes params, geometry (`buildSolid`, L104–145), an orientation
  `{ax, ay, az}`, and paint modifiers `{ dark, dx, hueMix, lighten, sleeping }` and
  returns the inner markup of the geometry `<g>`. That is the `paint` boundary.
- *Polyhedron-specific code:* `PORTRAITS` (L24–29), `describeParams` (L97–100),
  `buildSolid` (L104–145), `rot3` (L149–157), `shadeFor` (L180–184), `renderInner`
  (L186–233), the working-state initial orientation (L427–431), the whole per-state
  motion body of `step` (L316–375, reads `p.axisMode/speed/precess/zSpeed/phase/phase2`
  and `PORTRAITS`), and the `size < 28 && finish === 2 → finish 0` rule (L261, L416).
  `lerpHue`, `angDiff`, `wrapAngle` (L159–176) are used only by that code.
- *Shared code:* option defaults (`size || 64`, `kind || 'agent'`, `dark` via
  `autoDark()` L397–400), the SVG shell (`viewBox 0 0 100 100`, `role="img"`, two `<g>`
  children geometry-then-ring: L265–267, L420–421), `STATES` (L22), `STATUS_RING` and
  `RING_FOR_STATE` (L31–43), `ringMarkup` (L235–245), `describeInstance` (L247–251,
  `"<rawSeed>: <describe(p)>[, <state>]"`), the public↔internal state map and flash
  configuration in `setState` (L462–474), sticky `publicState`, flash timing
  (L376–386: `s` envelope over 1.4 s, `lighten = 26*s`, `dx = sin(t*36)*3.2*exp(-t*6)`),
  the `sending/receiving → settling` 0.4 s timer (L366–375), the engine singleton
  `let engine = null` (L272) with `reduced` read once from `matchMedia` (L276–277),
  `instances`, the optional `IntersectionObserver` (L279–286), the injected
  `<style id="prismicon-style">` (L287–296), the 33 ms frame budget and `dt ≤ 0.05`
  clamp (L298–306), `ensureRunning` (L307–312), and the dirty-paint DOM write
  (L387–391: `inst.g.innerHTML = …` plus `opacity="0.7"` while sleeping).
- *Only variant-dependent flash input:* `hueMix = lerpHue(p.hue, inst.flash, 0.75*s)`
  (L381) reads the polyhedron's `p.hue`; `receiving` sets `inst.flash = p.hue` (L467).
  Everything else in the flash is status tuning shared across variants.
- *DOM strategy:* the `<svg>` is created once; geometry and ring `<g>` are replaced via
  `innerHTML`; `aria-label` is set on `<svg>`. Tests rely on the `<svg>` node surviving
  `setState` and on `svg > g` order.
- *Reduced motion:* instances are never registered with the engine (L438), `setState`
  takes a static branch (L454–461), `ensureRunning` never schedules rAF (L308), and CSS
  `.prismicon svg *{animation:none!important}` under the media query (L295) kills ring
  animations. `renderStaticSVG` never touches `window` (SSR-safe).
- *`kind: 'user'`:* no ring, no state suffix, never in the engine, `setState` is a
  silent no-op (L263, L250, L438, L452).
- *No option validation throws today* (unknown `state` → no ring; unknown `kind` →
  non-agent). The registry, by contrast, throws `RangeError`/`TypeError`
  ([src/variants/registry.js](../../../../src/variants/registry.js#L111-L125)) per wave-1
  decision 3, so `variant` becomes the first throwing option — it must throw *before*
  `mountGlyph` mutates `el`.
- *Wave-1 modules:* [src/variants/polyhedron.js](../../../../src/variants/polyhedron.js)
  binds `deriveV1, describeParams, renderStaticSVG, mountGlyph` from `../core.js`, so a
  dispatcher inside `core.js` that imports the registry would create an import cycle —
  the hand-off recorded in
  [variant-registry-contract/review.md](../variant-registry-contract/review.md) Follow-ups
  and [plan.md](../variant-registry-contract/plan.md) ("Wave-2 hand-off note"). The
  review also flags that `BUILT_IN_VARIANTS.get('polyhedron') !== polyhedron` because
  `createVariantRegistry` re-runs `defineVariant` (copies), and that `src/variants/*`
  ships without `index.d.ts` coverage.
- *Tests:* [test/prismicon.test.js](../../../../test/prismicon.test.js) (12 tests)
  builds a JSDOM with mocked `matchMedia`/`requestAnimationFrame` and no
  `IntersectionObserver`, uses cache-busting imports (`../src/core.js?motion-test`) to
  get a fresh engine per test, and asserts aria-labels, ring dasharrays, `svg > g`
  innerHTML changes across frames, rAF counts, and `<g opacity="0.7">`.
  [test/variants.test.js](../../../../test/variants.test.js) has a public-surface guard
  (L203–221) asserting exactly the 11 current `src/index.js` export names and *no* key
  matching `/variant/i` — it must be updated deliberately when the surface grows — and
  parity tests (`PARITY_OPTS`, L17) comparing the descriptor's `renderStatic` with
  `renderStaticSVG`. [test/derivation-freeze.test.js](../../../../test/derivation-freeze.test.js)
  imports `deriveV1` from `../src/core.js` and deep-equals the `FROZEN` fixture.
- *React:* [src/react.js](../../../../src/react.js#L14) imports only `renderStaticSVG`
  and `mountGlyph` from `./core.js`; effect deps `[seed, size, kind, dark]` (L45–52) and
  `[state]` (L54–56). Not touched this wave; `react-variant-selection` adds the prop.
- *Types/docs/demo:* [index.d.ts](../../../../index.d.ts#L30-L42) declares
  `GlyphOptions { size?, kind?, state?, dark? }` and `GlyphHandle { params, state,
  setState, destroy }`. [README.md](../../../../README.md) has `## Vanilla API` (L88) then
  `## Derivation spec v1 (frozen)` (L106) — a `## Variants` section fits between them.
  [demo/index.html](../../../../demo/index.html#L36-L51) imports from `../src/index.js`
  via `<script type="module">`, mounts a hero glyph exposed as `window.handle`, and
  renders one button per state; there is no serve script (`package.json` has only
  `test`), and Chromium blocks `file://` module imports, so browser verification needs
  a static server.
- *Packaging:* `"type": "module"`, `"sideEffects": false`, `files: ["src", "index.d.ts",
  "README.md", "LICENSE"]` — `test/` and `scripts/` never ship; exports `.` and
  `./react` only; devDependencies `jsdom ^26.1.0`, `react`/`react-dom ^19.2.0`, no
  `@types/react`, no `engines` field. Node in this environment: v22.

**Skill guidance applied.**

- *modern-javascript-patterns:* pure functions and immutable data — poses are
  immutable values returned from `animate` (never mutated in place), descriptors and
  registries stay `Object.freeze`d; small single-purpose hooks; explicit typed errors
  (`RangeError` unknown id, `TypeError` bad key) surfaced at the API boundary before any
  side effect; module boundaries chosen to remove the import cycle.
- *vercel-react-best-practices:* `server-no-shared-module-state` — no mutable
  module-level registry; the only module state remains the lazily created client-only
  animation engine, which is shared by all renderers so one rAF loop exists
  (`client-event-listeners` spirit). `bundle-analyzable-paths` / `sideEffects: false` —
  built-ins remain a static import graph, no import-time registration. `js-early-exit` —
  resolve and validate `variant` first, return/throw before DOM work.
  `rendering-hydration-no-flicker` — `renderStaticSVG` stays `window`-free so SSR and
  first client paint remain identical.

**Concurrent delivery.** `gh pr list --state open --json number,headRefName` returned
`[]`; no other delivery branch exists, so no file overlap to sequence around.

**Slug reservation.** `agento.mjs find variant-renderer-integration` → `status:
missing`; neither `feature/variant-renderer-integration` nor
`origin/feature/variant-renderer-integration` existed; the branch was created from the
detached `origin/main` HEAD (`ec81fac`) in this planning worktree before any artifact
was written. Per-slug ports: `agento.mjs ports variant-renderer-integration` →
`WEB_PORT 3128`.

## Approach

### Module layout (breaks the cycle)

- **`src/variants/polyhedron.js`** becomes the complete polyhedron implementation: the
  v1 header comment, `SPEC_VERSION`, `SIDE_NAMES`, `SOLID_NAMES`, `FINISH_NAMES`,
  `PALETTE`, `PORTRAITS`, `cyrb53`, `mulberry32`, `normalizeSeed`, `deriveV1`,
  `describeParams`, `buildSolid`, `rot3`, `lerpHue`, `angDiff`, `wrapAngle`, `shadeFor`,
  the painter, and the motion code — moved verbatim from `src/core.js` — plus the five
  hook functions and `export const polyhedron = defineVariant({...})`. It imports only
  `./registry.js`. Frozen function bodies are moved, not edited; the golden fixtures and
  `FROZEN` prove it.
- **`src/core.js`** becomes the shared pipeline: `STATES`, `STATUS_RING`,
  `RING_FOR_STATE`, `ringMarkup`, `describeInstance`, `autoDark`, the engine, and
  `createRenderer(registry)`. It imports `./variants/index.js` (for
  `BUILT_IN_VARIANTS`) and re-exports the v1 identity names (`SPEC_VERSION`, `PALETTE`,
  `SIDE_NAMES`, `SOLID_NAMES`, `FINISH_NAMES`, `normalizeSeed`, `deriveV1`,
  `describeParams`) from `./variants/polyhedron.js` so `src/index.js`, `src/react.js`,
  and `test/derivation-freeze.test.js` keep their import paths and the cache-busting
  `../src/core.js?…` imports in `test/prismicon.test.js` keep yielding a fresh engine.
- **`src/variants/registry.js`** keeps zero imports from the engine.
  **`src/variants/index.js`** adds `listVariants(registry = BUILT_IN_VARIANTS)`.
- Import graph after the change: `index.js → core.js → variants/index.js →
  { registry.js, polyhedron.js → registry.js }`; `core.js → polyhedron.js` (re-exports).
  No module under `src/variants/` imports `core.js` (verified by `grep`).

### Descriptor contract v2 (`defineVariant`)

Identity fields unchanged (`id`, `label`, `spec`). Hooks — all required functions,
unknown keys still rejected; `renderStatic` and `mount` are **removed**:

| Hook | Signature | Owner of the concern |
|---|---|---|
| `derive(seed)` | → `params` (pure, deterministic) | identity |
| `describe(params)` | → anatomy phrase used in the aria-label | accessibility text |
| `prepare(params, { size })` | → `params` (may return the same object); polyhedron applies `size < 28 && finish === 2 → finish 0`; the result is `handle.params` | size adaptation |
| `geometry(params)` | → opaque immutable geometry, built once per render/mount | geometry |
| `pose(params, state)` | → immutable rest pose for a public state; the engine calls `pose(params, 'idle')` for the rest pose and `pose(params, initialState)` at mount; polyhedron returns `PORTRAITS[solidType]` except the phase-seeded `working` orientation | pose |
| `animate(pose, ctx)` | `ctx = { params, state, dt, t, transientT, rest }` where `state` is the internal state (`working`, `waiting`, `thinking`, `sleeping`, `sending`, `receiving`, `settling`, `idle`); returns the next pose — return the **same reference** for "no change"; while `settling`, returning `ctx.rest` tells the engine the transition is complete | motion |
| `paint(params, geometry, pose, effects)` | `effects = { dark, sleeping, dx, lighten, flash }` with `flash: null \| { hue: number \| null, strength }` (`hue: null` = the variant's own identity hue, as `receiving` uses today); returns the inner markup of the geometry `<g>` | painting |

Poses are treated as immutable: `animate` returns new objects, never mutates its input
(so `ctx.rest` can be shared). The polyhedron `paint` computes
`hueMix = lerpHue(p.hue, flash.hue ?? p.hue, flash.strength)` with the identical
expression that `step` uses today; the engine computes `strength = 0.75 * s`,
`lighten = 26 * s`, and `dx` exactly as L376–386 do now, so frame bytes do not change
(golden-verified).

### Shared engine (variant-agnostic)

Instance record gains `variant`, `pose`, `rest`, `geo` (from `variant.geometry`); loses
`ori`. `step(inst, dt, tSec)`:

1. skip when `!inst.visible`;
2. if internal state is `sending`/`receiving`: `transientT += dt`;
3. `next = variant.animate(inst.pose, ctx)`; `dirty = next !== inst.pose`; if state is
   `settling` and `next === inst.rest` → internal state `idle`; if state is
   `sending`/`receiving` and `transientT > 0.4` → `settling` (after the animate call,
   matching L374); `inst.pose = next`;
4. flash bookkeeping exactly as today, producing `effects` and setting `dirty`;
5. if `dirty`: `inst.g.innerHTML = variant.paint(p, inst.geo, inst.pose, effects)` and
   the sleeping `opacity` toggle.

`mountGlyph` order: resolve `variant` → normalise options → `p = variant.prepare(
variant.derive(seed), { size })` → `geo`, `rest`, initial pose → **only then** touch
`el`. `setState` maps public→internal state and flash config as today; the reduced
branch resets `inst.pose = inst.rest` and repaints. `describeInstance` becomes
`${seedRaw}: ${variant.describe(p)}` + `, ${state}` for agents. `handle.variant` is the
descriptor `id`.

### Dispatch and public API

- `createRenderer(registry)` (exported from `src/core.js`, **not** from `src/index.js`
  this wave) returns `{ renderStaticSVG, mountGlyph }` closed over the registry; all
  renderers share the module engine (one rAF loop, one `<style>`). The public
  `renderStaticSVG`/`mountGlyph` are the default renderer over `BUILT_IN_VARIANTS`.
  Both call `registry.resolve(opts.variant)` first; `RangeError`/`TypeError` propagate.
- `src/index.js` adds `DEFAULT_VARIANT_ID` and `listVariants` (13 exports). `index.d.ts`
  adds `GlyphOptions.variant?: string`, `GlyphHandle.variant: string`,
  `interface VariantInfo { id: string; label: string; spec: string }`,
  `DEFAULT_VARIANT_ID`, `listVariants(): ReadonlyArray<VariantInfo>`.
- `README.md` gains `## Variants` between `## Vanilla API` and `## Derivation spec v1`.
- `src/react.js` and `package.json` are untouched.

### Guard rails and tests

- **Golden fixtures first.** Before any `src/` change: `test/helpers/golden.js` (JSDOM
  harness modelled on `test/prismicon.test.js`, exporting `captureGolden()`),
  `scripts/generate-golden.mjs` (writes `test/fixtures/golden-v1.json`), and
  `test/golden-v1.test.js`. Captured: full `renderStaticSVG` strings for seeds `maya`,
  `build-bot-7`, `Alice@X.com`, `Ada Lovelace`, `demo-agent` × option sets `{}`,
  `{ size: 24 }`, `{ kind: 'user' }`, `{ state: 'thinking', dark: true }`,
  `{ state: 'waiting' }`, `{ state: 'error', size: 140 }`; and SHA-256 digests of
  `svg.outerHTML` per frame for mounted agents (`maya`, `build-bot-7`, one at size 24,
  one `dark: true`) driven through a fixed timestamp schedule (`1000 + 33·k`) covering
  `working` then each of `waiting, thinking, sleeping, sending, receiving, done, error,
  idle`, plus a reduced-motion sequence. Digests keep the fixture small; the assertion
  message names scenario and frame and the regenerate command.
- **Dispatch proof.** `test/fixtures/square-variant.js` (`id: 'square'`, `spec:
  'test-square-1'`, `<rect>` rotated by pose angle; `animate` spins while `working`,
  eases and returns `ctx.rest` when settling) and `test/renderer-dispatch.test.js` via
  `createRenderer(createVariantRegistry([polyhedron, square], { defaultId:
  'polyhedron' }))`.
- **Updated tests:** `test/variants.test.js` descriptor/registry suites for the v2 hooks;
  polyhedron suite asserts hook identities (`derive === deriveV1`, `describe ===
  describeParams`), `FROZEN` parity, and `renderStaticSVG(seed, { variant:
  'polyhedron' }) === renderStaticSVG(seed)` for `PARITY_OPTS`; public-surface guard
  updated to the 13 names. `test/prismicon.test.js` and
  `test/derivation-freeze.test.js` are **not modified** (diff-checked).

### Demo

`demo/index.html`: `<select id="variant">` populated from `listVariants()` (`label`
text, `id` value, `DEFAULT_VARIANT_ID` selected); on change, `handle.destroy()` and
remount the hero with the current `handle.state` and `{ variant }`, reassign
`window.handle`. Verified on `local:3128` with `python3 -m http.server 3128 --bind
127.0.0.1` from the repo root and the Builder driving a browser; screenshot under this
slug's `evidence/`.

## Risks

- **Default output drifts during the refactor** (highest). Mitigation: golden fixtures
  captured from unmodified `origin/main` code *before* step 2.1; frozen function bodies
  are moved, not rewritten; flash/`dt`/timer arithmetic is kept in the same order;
  `test/derivation-freeze.test.js` and `test/prismicon.test.js` stay untouched and green.
- **Import cycle** (`core.js ↔ variants/polyhedron.js`). Mitigation: the polyhedron
  implementation moves into `src/variants/polyhedron.js`; `grep -c "core.js"
  src/variants/*.js` must print `0` for every file; ordered steps 2.1→2.3 keep every
  intermediate commit green (2.2 temporarily binds the old-shape descriptor in
  `variants/index.js`, which imports `core.js` while `core.js` imports only
  `polyhedron.js`).
- **Hook contract too narrow for n-cube/motion waves.** Mitigation: hooks mirror the
  seams that exist (`prepare`, `geometry`, `pose`, `animate`, `paint`); `ctx` carries
  `t`, `dt`, `transientT`, `rest`; poses and geometry are opaque to the engine; the
  `square` fixture proves a non-polyhedron variant fits. Additions remain a single
  validator change.
- **Throwing option breaks existing callers.** Only when `variant` is supplied and
  invalid; omitting it is unchanged. Thrown before any DOM mutation so a failed
  `mountGlyph` leaves `el` intact (tested).
- **Engine singleton and multiple renderers.** Mitigation: `createRenderer` shares the
  module-level engine; a test mounts through two renderers and asserts one rAF chain.
- **Public-surface guard and types drift.** Mitigation: the guard is updated in the same
  step as the exports; `index.d.ts` is parsed with `tsc` (the only tolerated diagnostic
  is the pre-existing unresolved `react` module, since `@types/react` is not installed).
- **Browser verification has no serve script.** Mitigation: `python3` is present
  (`/usr/bin/python3`); the roadmap names the exact command and port from
  `agento.mjs ports`.
- **Concurrent delivery.** No open PRs at planning time; integrate `origin/main` by
  merge before every push (policy §7).

## Out of scope

- `variant` prop on the React component (`react-variant-selection`).
- Any shipped second variant, n-cube geometry or motion (`ncube-geometry-family`,
  `ncube-motion-system`).
- Public `defineVariant`/`createVariantRegistry`/`createRenderer`, a `variants` option,
  or any consumer registration API (`custom-variant-authoring`).
- Authoring validation tooling, package checks, or a serve/dev script
  (`variant-build-tooling`).
- `data-variant` attributes, `<title>` elements, or any change to default markup bytes.
- Changes to the v1 derivation, `FROZEN` fixture, `package.json`, or `src/react.js`.

## Acceptance checklist

- [ ] `npm test` exits 0 with `# fail 0` and at least 32 baseline tests plus every test
  in `test/golden-v1.test.js`, `test/renderer-dispatch.test.js`, and the updated
  `test/variants.test.js` (verify: `npm test` summary lines).
- [ ] `test/fixtures/golden-v1.json` was generated from `src/` identical to
  `origin/main` and `test/golden-v1.test.js` passes against the final code — default
  static markup and mounted frame digests are byte-identical (verify: fixture commit
  precedes every `src/` change in `git log --oneline -- src test/fixtures`; `npm test`).
- [ ] `test/prismicon.test.js`, `test/derivation-freeze.test.js`, `src/react.js`, and
  `package.json` have no diff from `origin/main` (verify: `git diff --quiet origin/main
  -- test/prismicon.test.js test/derivation-freeze.test.js src/react.js package.json`).
- [ ] `defineVariant` requires `derive`, `describe`, `prepare`, `geometry`, `pose`,
  `animate`, `paint` and rejects `renderStatic`/`mount` as unknown keys (verify:
  `test/variants.test.js`).
- [ ] `renderStaticSVG(seed, { variant: 'polyhedron' })` equals `renderStaticSVG(seed)`
  for every `PARITY_OPTS` entry and the frozen seeds (verify: `test/variants.test.js`).
- [ ] With a registry containing the `square` fixture: static markup contains the
  square's paint output, the state ring, and aria-label `"<seed>: <describe>, working"`;
  `kind: 'user'` has no ring or state suffix; a mounted `working` square changes
  geometry between frames; `setState` updates ring and aria-label; reduced motion yields
  zero rAF calls and a static rest pose while rings still update; `destroy()` empties
  the host (verify: `test/renderer-dispatch.test.js`).
- [ ] `renderStaticSVG(seed, { variant: 'nope' })` and `mountGlyph(el, seed, { variant:
  'nope' })` throw `RangeError` naming `nope` and the registered ids; a non-string
  `variant` throws `TypeError`; after the throw `el.innerHTML === ''` and `el` has no
  `prismicon` class; the default renderer rejects `'square'` (verify:
  `test/renderer-dispatch.test.js`).
- [ ] `handle.variant` equals the resolved id for default and non-default variants
  (verify: `test/renderer-dispatch.test.js`).
- [ ] Two renderers created by `createRenderer` share one engine: mounting through both
  produces a single rAF chain (verify: `test/renderer-dispatch.test.js`).
- [ ] `src/index.js` exports exactly the 11 v1 names plus `DEFAULT_VARIANT_ID` and
  `listVariants`; `listVariants()` returns a frozen array of frozen `{ id, label, spec }`
  equal to `[{ id: 'polyhedron', label: 'Polyhedron', spec: 'v1' }]` (verify:
  public-surface test in `test/variants.test.js`).
- [ ] No file under `src/variants/` imports `core.js` (verify: `grep -c "core.js"
  src/variants/registry.js src/variants/polyhedron.js src/variants/index.js` prints `0`
  three times).
- [ ] `index.d.ts` declares `GlyphOptions.variant?`, `GlyphHandle.variant`,
  `VariantInfo`, `DEFAULT_VARIANT_ID`, `listVariants` and parses under `tsc --strict`
  with no diagnostic other than the pre-existing unresolved `react` import (verify:
  roadmap step 4.2 command).
- [ ] `README.md` has a `## Variants` section documenting per-icon `variant`,
  `listVariants()`, `DEFAULT_VARIANT_ID`, and the throw-on-unknown rule (verify:
  `grep -n "^## Variants" README.md`).
- [ ] `demo/index.html` offers a variant `<select>` built from `listVariants()` that
  remounts the hero glyph; on `local:3128` the page loads without console errors, the
  select lists `polyhedron`, and remounting keeps the hero's aria-label state (verify:
  browser run per step 5.2 with screenshot `evidence/step-5-2-demo-variant-select.png`).
- [ ] `npm pack --dry-run` lists `src/core.js`, `src/variants/index.js`,
  `src/variants/registry.js`, `src/variants/polyhedron.js` and nothing from `test/` or
  `scripts/` (verify: command output).
- [ ] Lint gate: no lint is configured (AGENTS.md); the complete gate is the full
  `npm test` run compared with the recorded baseline (32 pass → 32 + new pass, 0 fail)
  (verify: `npm test`).
