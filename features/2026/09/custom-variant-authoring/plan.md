# Custom variant authoring

## Problem

Every rendering path already dispatches through the variant contract — `createRenderer(registry)`
in [src/core.js](../../../../src/core.js#L72-L169) resolves `opts.variant` through a registry and
calls the descriptor's eight hooks — and
[test/fixtures/square-variant.js](../../../../test/fixtures/square-variant.js) proves a variant
with no shared polyhedron code renders, animates, flashes and honours reduced motion through
[test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L45-L158). But none of
that is reachable by a package consumer: [src/index.js](../../../../src/index.js) exports only
`DEFAULT_VARIANT_ID` and `listVariants`; `defineVariant`, `createVariantRegistry`,
`VARIANT_ID_PATTERN` ([src/variants/registry.js](../../../../src/variants/registry.js#L47-L127))
and `createRenderer` are internal; `renderStaticSVG`/`mountGlyph` are bound once to
`BUILT_IN_VARIANTS` ([src/core.js](../../../../src/core.js#L168)); the React component imports
those bound functions and `resolveVariant` against the built-in registry
([src/react.js](../../../../src/react.js#L14-L15), [L39](../../../../src/react.js#L39));
[index.d.ts](../../../../index.d.ts) has no descriptor, hook, or registry types; and
[README.md](../../../../README.md) `## Variants` documents only built-ins. The only way to add a
variant today is to edit package source.

This feature implements the `### custom-variant-authoring` member block of
[scalable-icon-variants/breakdown.md](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
(wave 3; requires `variant-renderer-integration`, `status: complete`; recommended after
`react-variant-selection`, `status: complete`). Brief: *"Include custom consumer-defined variants
and make future variants straightforward to add and manage."* Summary: expose a supported consumer
extension API for defining, registering, validating, and selecting custom variants without
modifying package internals.

User-visible effect: a consumer writes a descriptor object, validates it with
`validateVariant(descriptor)` (shape + determinism + SSR-safety probes), builds an instance with
`createPrismicon({ variants: [descriptor] })` that returns `renderStaticSVG`, `mountGlyph`,
`listVariants` and `registry` bound to built-ins plus their variants, and in React wraps a tree in
`<PrismiconProvider registry={registry}>` so the existing `<Prismicon variant="my-id" />` resolves
custom ids. Everything stays typed in `index.d.ts`, documented in the README, and demonstrated in
the demo. Callers that touch none of this keep byte-identical output.

## Decisions

Clarifying questions were asked against the member brief; answers are verbatim.

1. **Registration model.** How should consumers make a custom variant usable by
   `renderStaticSVG`/`mountGlyph`? (registry today is immutable, built once; package is
   `sideEffects: false`)

   > Factory: createPrismicon({ variants, defaultId })

   (Not selected: inline descriptor as the `variant` value; global `registerVariant`.)

2. **React integration.** How should React consumers use custom variants?

   > <PrismiconProvider registry> context

3. **Validation depth.** Beyond today's shape check in `defineVariant` (id/label/spec + 8
   function hooks), what should validation enforce?

   > Determinism probe
   > SSR safety probe

   (Not selected: output-contract-only checks as a separate tier; shape check only. The
   output checks that the probes need in order to compare results — `describe()` returns a
   non-empty string, `paint()` returns a string, `flash()` returns `null` or an object — are
   part of the probes.)

4. **Package surface.** Where should the authoring API be exported?

   > Root export (prismicon)

5. **Docs & demo.** Should this feature include a README authoring guide and a demo authoring
   example?

   > README guide + demo example

## Research

Skills consulted: modern-javascript-patterns, vercel-react-best-practices

**Lint baseline (policy §5).** AGENTS.md declares `Lint: none` and `Typecheck: none`;
`package.json` has a single script `"test": "node --test test/*.test.js"`. There is no
full-repository lint command to run, so the baseline is *no lint configured, exit n/a, zero
findings*. Overlap is therefore impossible; the complete gate for this delivery is the full
test suite plus the two ad-hoc checks prior deliveries used:
`npm test` → `# tests 86`, `# pass 86`, `# fail 0` on `origin/main` `1235225` after `npm ci`
(the fresh worktree initially printed `# fail 6`, all `ERR_MODULE_NOT_FOUND: jsdom` before
`npm ci`); `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types ""
index.d.ts` → exactly one pre-existing `error TS7016` for `'react'`
([react-variant-selection/roadmap.md](../react-variant-selection/roadmap.md) step 2.2); and
`node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures` for frozen output.

**Concurrent delivery.** `gh pr list --state open` returned `[]`; no other delivery branch
touches any file in this plan.

**Existing contract (what the plan builds on, not changes).**

- `defineVariant` ([src/variants/registry.js](../../../../src/variants/registry.js#L69-L98))
  enforces: plain object; only keys `id, label, spec, derive, describe, prepare, geometry,
  pose, animate, paint, flash`; `id` matches `VARIANT_ID_PATTERN = /^[a-z][a-z0-9-]*$/`;
  `label`/`spec` non-empty strings; all eight hooks functions; returns a frozen shallow copy.
  Error messages name the offending field.
- `createVariantRegistry(descriptors, { defaultId })`
  ([L102-L127](../../../../src/variants/registry.js#L102-L127)) rejects non-arrays, duplicate
  ids, and an unregistered `defaultId`; returns a frozen `{ ids, defaultId, has, get, resolve }`
  where `resolve(undefined|null)` → default, unknown string → `RangeError` listing registered
  ids, non-string → `TypeError`. No mutation API by design (registry-contract Decision 1
  kept it internal; renderer-integration and react-variant-selection reviews list no
  scoped-registry follow-ups).
- `createRenderer(registry)` ([src/core.js](../../../../src/core.js#L72-L166)) is already the
  factory this feature needs: it closes over a registry and returns `{ renderStaticSVG,
  mountGlyph }`; the module-level pair is `createRenderer(BUILT_IN_VARIANTS)`
  ([L168](../../../../src/core.js#L168)). The shared animation engine (`getEngine()`,
  [L174+](../../../../src/core.js#L174)) is module-global and registry-agnostic, so instances
  from several renderers share one `requestAnimationFrame` loop.
- Hook call sites: `derive`/`prepare`/`geometry`/`pose('idle')`/`paint` in both render paths
  ([L74-L80](../../../../src/core.js#L74-L80), [L88-L113](../../../../src/core.js#L88-L113));
  `describe` in `describeInstance` ([L65](../../../../src/core.js#L65)); `flash` on
  transitions ([L149-L156](../../../../src/core.js#L149-L156)); `animate` per frame
  ([L224](../../../../src/core.js#L224)). Under reduced motion `animate` is never called and
  `pose` is `rest` ([L204-L209](../../../../src/core.js#L204-L209)), so a variant's idle
  `paint` *is* its reduced-motion appearance.
- `BUILT_IN_VARIANTS`, `resolveVariant(key, registry = BUILT_IN_VARIANTS)` and
  `listVariants(registry = BUILT_IN_VARIANTS)` already take an optional registry
  ([src/variants/index.js](../../../../src/variants/index.js#L12-L32)).
- React: `Prismicon` calls `resolveVariant(variant)` at render, builds `initialMarkup` once
  with the bound `renderStaticSVG`, and mounts with the bound `mountGlyph` in an effect keyed
  on `[seed, size, kind, dark, variant]` ([src/react.js](../../../../src/react.js#L27-L67)).
  [test/react-variant.test.js](../../../../test/react-variant.test.js#L148) pins the entry's
  exports to exactly `['Prismicon', 'default']` — that assertion must grow to include the
  provider.
- Types: `index.d.ts` declares `GlyphOptions.variant?: BuiltInVariantId | (string & {})`
  ([L57](../../../../index.d.ts#L57)), `VariantInfo` ([L79-L82](../../../../index.d.ts#L79-L82)),
  `listVariants` and `DEFAULT_VARIANT_ID`; nothing for descriptors, hooks, or registries.
- Packaging: `exports` has `.` and `./react` only; `files` ships `src`, so new modules under
  `src/` publish automatically; `sideEffects: false` and no build step must hold
  ([package.json](../../../../package.json#L8-L24)).
- Demo: [demo/index.html](../../../../demo/index.html#L44-L56) imports the bound API from
  `../src/index.js`, fills the hero `<select>` from `listVariants()`, and remounts on change.
- Tests: `node:test` + `node:assert/strict`, JSDOM harnesses with mocked `matchMedia` and
  counted `requestAnimationFrame` ([test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L20-L45),
  [test/react-variant.test.js](../../../../test/react-variant.test.js#L22-L40)); goldens via
  [test/helpers/golden.js](../../../../test/helpers/golden.js) regenerated by
  [scripts/generate-golden.mjs](../../../../scripts/generate-golden.mjs).

**Skill guidance applied.** modern-javascript-patterns: pure functions, `const`, no shared
mutable state, spread/freeze for immutability — `createPrismicon` returns a new frozen instance
instead of mutating a global registry; `validateVariant` restores globals in `finally`.
vercel-react-best-practices: `rerender-memo-with-default-value` / `rerender-dependencies` — the
provider value is memoised on the `registry` object identity and consumers are told to hoist
`createPrismicon(...)` to module scope; `bundle-*` — no new entry point, no import-time work,
`sideEffects: false` preserved; `server-no-shared-module-state` — the SSR probe and the renderer
never write module-level request state.

## Approach

All new code is additive; `src/core.js`, `src/variants/registry.js`, `polyhedron.js`, `ncube.js`
and the golden fixtures do not change.

1. **`src/variants/validate.js` — `validateVariant(descriptor, options?)`.** Pure module (no
   `core.js` import). Steps, each throwing `TypeError` whose message starts with
   `Variant "<id>"` and names the failing probe and hook:
   1. `const variant = defineVariant(descriptor)` (shape).
   2. *Output contract needed by the probes*: for each probe seed, `derive(seed)` returns a
      plain object; `describe(params)` returns a non-empty string; `prepare(params, { size })`
      and `geometry` return objects; `pose(params, state)` returns an object for every state
      in `STATES` plus `'settling'`; `paint(...)` returns a string; `flash(params, state)`
      returns `null` or a plain object with only `hue`/`lighten`/`shake` keys of the right
      types; `animate(pose, ctx)` with `ctx = { params, state, dt: 1/60, t: 0, transientT: 0,
      rest }` returns an object.
   3. *Determinism probe*: run the full pipeline twice per seed (`derive → prepare → geometry
      → pose(state) → paint(params, geometry, pose, effects)` for each state, plus `flash` and
      one `animate` step) and require `JSON.stringify` equality of every params/geometry/pose
      object and strict equality of every `paint` string between the two runs. Seed
      normalisation is the variant's own business; only same-input/same-output is enforced.
   4. *SSR-safety probe*: temporarily redefine each configurable globalThis property in
      `['window', 'document', 'navigator', 'matchMedia', 'requestAnimationFrame',
      'cancelAnimationFrame', 'localStorage', 'sessionStorage', 'IntersectionObserver']` with
      a getter that throws a tagged `Error`, run the static pipeline (`derive → prepare →
      geometry → pose('idle') → describe → paint`) once per seed, and restore the original
      property descriptors in `finally`. A tagged throw is rethrown as `TypeError('Variant
      "<id>" hook "<hook>" accessed browser global "<name>" during static rendering')`. Node
      exposes `navigator` as a configurable getter; non-configurable properties are skipped.
   5. Return `variant` (the frozen descriptor) so `const v = validateVariant({...})` composes.
   Defaults: `seeds = ['maya', 'build-bot-7', 'Alice@X.com', 'Ada Lovelace', 'demo-agent']`
   (the `STATIC_SEEDS` of [test/helpers/golden.js](../../../../test/helpers/golden.js#L7)),
   `size = 64`, `states = [...STATES, 'settling']`, `effects = { dark: false, sleeping: false, dx: 0, lighten: 0, flash: null }` and
   a second pass with `dark: true`.

2. **`src/authoring.js` — `createPrismicon(options?)`.** Imports `createRenderer` from
   `./core.js`, `BUILT_IN_VARIANTS`, `DEFAULT_VARIANT_ID`, `listVariants` from
   `./variants/index.js`, `createVariantRegistry` and `validateVariant`.
   `createPrismicon({ variants = [], defaultId = DEFAULT_VARIANT_ID, builtIns = true, validate = true } = {})`:
   - `variants` must be an array (else `TypeError`); each entry passes through
     `validateVariant` when `validate` is true, otherwise only the registry's shape check.
   - registry = `createVariantRegistry([...(builtIns ? BUILT_IN_VARIANTS.ids.map(id =>
     BUILT_IN_VARIANTS.get(id)) : []), ...variants], { defaultId })` — duplicate ids
     (including shadowing a built-in) throw the existing `Duplicate prismicon variant id`
     `TypeError`; `builtIns: false` requires `defaultId` to name one of `variants`.
   - returns `Object.freeze({ registry, renderStaticSVG, mountGlyph, listVariants: () =>
     listVariants(registry) })` where the render pair is `createRenderer(registry)`.
   No module-level state; calling it twice yields independent instances sharing only the
   animation engine.

3. **Root exports — `src/index.js`.** Add `createPrismicon` (from `./authoring.js`) and
   `defineVariant`, `createVariantRegistry`, `validateVariant`, `VARIANT_ID_PATTERN` (from
   `./variants/index.js`, which gains the `validateVariant` re-export). `BUILT_IN_VARIANTS`
   stays internal (composition goes through `builtIns: true`).

4. **React — `src/react.js`.** Add `PrismiconRegistryContext = createContext(null)` and export
   `PrismiconProvider({ registry, children })`: validates `registry` is an object with
   `resolve`/`get`/`ids` (else `TypeError`), memoises `{ registry, ...createRenderer(registry) }`
   on `[registry]`, and renders `h(Context.Provider, { value }, children)`. `Prismicon` reads
   the context; when null it uses a module-level frozen default `{ registry: BUILT_IN_VARIANTS,
   renderStaticSVG, mountGlyph }` (the already-imported bound pair, so the no-provider path is
   unchanged). It then calls `ctx.registry.resolve(variant)` where it called `resolveVariant`,
   uses `ctx.renderStaticSVG` for `initialMarkup` and `ctx.mountGlyph` in the mount effect, and
   adds `ctx` to that effect's dependency list so swapping providers remounts. Exports become
   `Prismicon`, `PrismiconProvider`, `default`. `'use client'` stays; SSR of the provider is a
   plain context render.

5. **Types — `index.d.ts`.** In `prismicon`: `VariantHookEffects`, `VariantFlash`,
   `VariantAnimateContext`, `VariantDescriptor<P = object, G = object, Pose = object>` (the
   eight hooks typed as in the JSDoc typedef), `VariantRegistry` (`ids`, `defaultId`, `has`,
   `get`, `resolve`), `ValidateVariantOptions`, `PrismiconInstance` (`registry`,
   `renderStaticSVG`, `mountGlyph`, `listVariants`), `CreatePrismiconOptions`, and the
   functions `defineVariant`, `validateVariant`, `createVariantRegistry`, `createPrismicon`,
   plus `const VARIANT_ID_PATTERN: RegExp`. In `prismicon/react`: `PrismiconProviderProps
   { registry: VariantRegistry; children?: ReactNode }` and `PrismiconProvider`.

6. **Example and demo.** Move the square variant to `demo/square-variant.js` written the way
   the README tells consumers to (`export const square = defineVariant({...})` importing from
   `../src/index.js`), and turn `test/fixtures/square-variant.js` into
   `export * from '../../demo/square-variant.js'` so existing tests keep their import paths and
   the documented example is the one under test. `demo/index.html` builds
   `const prismicon = createPrismicon({ variants: [square] })` at module scope, fills the hero
   `<select>` from `prismicon.listVariants()` (so `Square` appears after the built-ins), mounts
   the hero with `prismicon.mountGlyph`, and adds a `## Custom variant` section showing the
   square at three states with a one-paragraph pointer to the README guide. The Dimensions
   gallery keeps using the same instance.

7. **README.** New `## Custom variants` section between `## Variants` and `## Derivation spec
   v1 (frozen)`: the descriptor contract (fields, the eight hooks with signatures and when the
   engine calls them, reduced-motion = idle `paint`, `spec` versioning rule, id pattern),
   `validateVariant` (what the probes check and the error shape), `createPrismicon` (options,
   duplicate/shadowing rule, instance shape, hoist to module scope), the React provider
   (`registry` prop, nesting, remount on provider change), and the square example.

8. **Tests.** `test/authoring.test.js` (validate + createPrismicon), `test/react-variant.test.js`
   additions (provider), and `test/prismicon.test.js`/`test/variants.test.js` export-surface
   updates; details in the roadmap.

Affected files: `src/variants/validate.js` (new), `src/authoring.js` (new), `src/variants/index.js`,
`src/index.js`, `src/react.js`, `index.d.ts`, `demo/square-variant.js` (new), `demo/index.html`,
`test/fixtures/square-variant.js`, `test/authoring.test.js` (new), `test/react-variant.test.js`,
`test/variants.test.js`, `README.md`.

## Risks

- **SSR probe mutates `globalThis`.** Redefining `window`/`document` while a hook runs could
  break unrelated code if the probe were interrupted. Mitigation: the probe is synchronous,
  restores every descriptor in `finally`, skips non-configurable properties, and
  `test/authoring.test.js` asserts globals are identical before and after a passing and a
  failing probe. Consumers who need to skip it pass `validate: false` to `createPrismicon`.
- **Determinism probe cannot prove determinism.** Two identical runs catch `Math.random`/`Date`
  use but not seed-collision or platform-specific float formatting. Mitigation: document the
  probe as a smoke check and recommend consumers freeze their own goldens the way
  `scripts/generate-golden.mjs` does; `variant-build-tooling` owns deeper tooling.
- **Frozen v1 output.** Touching `src/react.js` and the render path used by the demo risks
  byte changes. Mitigation: `src/core.js` and the registry are untouched; the gate regenerates
  goldens and requires an empty diff; `git diff --quiet origin/main -- src/core.js
  src/variants/registry.js src/variants/polyhedron.js src/variants/ncube.js` is a roadmap check.
- **React entry surface change.** `test/react-variant.test.js` pins exports to
  `['Prismicon', 'default']`; the new `PrismiconProvider` export is intentional and the test is
  updated in the same step. `'use client'` on a module that now exports a provider is
  compatible with Next.js: the provider is a client component; server components pass a
  module-scope registry through it as a plain prop.
- **Hoisting requirement for the provider value.** Passing `registry={createPrismicon(...).registry}`
  inline would remount every glyph on each parent render. Mitigation: README and JSDoc say to
  hoist; the provider memoises on registry identity so a stable reference is enough.
- **Concurrent delivery.** No open PRs; still merge `origin/main` before every push.

## Out of scope

- Mutable/global registration (`registerVariant`), unregistering, or replacing built-ins by id.
- Passing a descriptor object directly as the `variant` option/prop.
- A `prismicon/variants` subpath or exporting built-in descriptor objects (`polyhedron`,
  `ncubeVariants`) for cherry-picked composition; `builtIns: false` + own list covers isolation.
- Behavioural checks beyond the two probes (accessibility text quality, output size or
  paint-time budgets, geometry bounds) — `variant-build-tooling`.
- n-cube motion (`ncube-motion-system`) and a second built-in family (`alternate-visual-variant`).
- A React demo page; React coverage stays in the Node/JSDOM suite (react-variant-selection
  Decision 4).

## Acceptance checklist

- [ ] `import { createPrismicon, validateVariant, defineVariant, createVariantRegistry, VARIANT_ID_PATTERN } from 'prismicon'` resolves: `node -e "import('./src/index.js').then(m => console.log(['createPrismicon','validateVariant','defineVariant','createVariantRegistry','VARIANT_ID_PATTERN'].every(k => k in m)))"` prints `true`, and `test/variants.test.js` asserts the root export list.
- [ ] `validateVariant` accepts the square example and every built-in descriptor, and rejects — with a `TypeError` naming the id, probe and hook — a variant whose `paint` uses `Math.random()` (determinism), whose `derive` reads `window` (SSR), whose `describe` returns `''`, and whose `flash` returns a non-null non-object (`node --test test/authoring.test.js` cases).
- [ ] `validateVariant` leaves `globalThis` unchanged after both a passing and a failing SSR probe (`test/authoring.test.js` compares `Object.getOwnPropertyDescriptor` for every probed name before and after).
- [ ] `createPrismicon({ variants: [square] })` returns a frozen instance whose `listVariants()` ids equal `[...BUILT_IN_VARIANTS.ids, 'square']`, whose `renderStaticSVG('maya', { variant: 'square' })` contains `<rect` and whose `mountGlyph(el, 'maya', { variant: 'square', state: 'working' })` animates in JSDOM; `variants: [{ ...square, id: 'polyhedron' }]` throws `Duplicate prismicon variant id`; `builtIns: false` without a matching `defaultId` throws; `validate: false` skips the probes (a `Math.random` variant is accepted) — all in `test/authoring.test.js`.
- [ ] A `createPrismicon` instance and the module-level `renderStaticSVG` produce byte-identical output for every built-in id on the golden seeds (`test/authoring.test.js` parity case), and `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures` exits 0.
- [ ] React: `renderToStaticMarkup(<PrismiconProvider registry={registry}><Prismicon seed="maya" variant="square" /></PrismiconProvider>)` equals the instance's `renderStaticSVG` output; the same tree without the provider throws `RangeError`; client mount inside the provider renders a `<rect>`; swapping the `registry` prop remounts the glyph; a non-registry `registry` prop throws `TypeError`; `Object.keys(await import('../src/react.js')).sort()` equals `['Prismicon', 'PrismiconProvider', 'default']` (`node --test test/react-variant.test.js`).
- [ ] `index.d.ts` declares `VariantDescriptor`, `VariantRegistry`, `PrismiconInstance`, `validateVariant`, `createPrismicon`, `defineVariant`, `createVariantRegistry`, `VARIANT_ID_PATTERN`, `PrismiconProvider`, `PrismiconProviderProps`, and `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts` reports exactly the one pre-existing `'react'` TS7016 error.
- [ ] `git diff --quiet origin/main -- src/core.js src/variants/registry.js src/variants/polyhedron.js src/variants/ncube.js` exits 0 (no changes to the frozen render path), and `npm pack --dry-run` lists `src/authoring.js` and `src/variants/validate.js` and nothing under `test/` or `demo/`.
- [ ] `README.md` has a `## Custom variants` section between `## Variants` and `## Derivation spec v1 (frozen)` covering the descriptor contract, `validateVariant`, `createPrismicon`, `PrismiconProvider`, and the square example (`grep -n "^## " README.md` order check; `grep -c "createPrismicon\|validateVariant\|PrismiconProvider" README.md` ≥ 6).
- [ ] Demo: served at `local:3115`, `demo/index.html` lists `Square` in the hero `<select>`, mounts the hero with the custom instance, and shows the Custom variant section; screenshot stored at `evidence/step-5-2-demo-custom-variant.png`.
- [ ] Complete gate (policy §5, no lint configured): `npm ci && npm test` prints `# fail 0` with `# tests` ≥ 110; the `index.d.ts` compile check above; golden regeneration diff empty; `git status --porcelain` empty after the final commit.
