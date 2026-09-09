# Variant registry contract

## Problem

prismicon renders exactly one visual style: the frozen v1 polyhedron defined in
[src/core.js](../../../../src/core.js). The initiative
[scalable-icon-variants](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
needs many selectable variants (an n-cube family, consumer-authored variants, an
alternate built-in style), each chosen per icon. Nothing in the codebase today names a
variant, describes what one must provide, or resolves a requested variant to an
implementation — so every later member would invent its own ad-hoc plumbing.

This feature implements the `### variant-registry-contract` member block of that
breakdown (wave 1, no dependencies). Brief: *"Establish the system for adding,
managing, and easily swapping among many future variants."* It defines the internal
variant descriptor, registry, lookup/fallback, and per-icon selection contracts, and
registers the current rendering as the built-in default variant `polyhedron`. It has
**no user-visible effect**: every public export, type, and rendered byte stays
identical. Its value is that waves 2–5 build on one documented, tested contract.

## Decisions

1. **Public surface for this wave.** Should the registry be exported from `prismicon`
   (`src/index.js` + `index.d.ts`) now — e.g. `registerVariant`, `getVariant`,
   `listVariants`, `DEFAULT_VARIANT` — or stay internal (`src/core.js`/new
   `src/variants.js`) until `variant-renderer-integration` lands?

   > stay internal

2. **Selection option shape.** Should `variant` be added to `GlyphOptions` /
   `PrismiconProps` in this wave as a string key even though only the default
   resolves, or should option/prop wiring wait for waves 2–3 and this wave define only
   the contract + registry?

   > whatever makes the project more likely to succeed in the long run

   Planner's resolution: do **not** wire `variant` into `GlyphOptions`/`PrismiconProps`
   yet (consistent with decision 1), but reserve the option name `variant` in the
   contract documentation so waves 2 and 3 use the same key and the same
   `resolveVariant()` semantics. Exposing an option that can only ever resolve to one
   value would lock the public API before a second implementation validates it.

3. **Fallback and error behavior.** When an unknown variant key is requested: (a) throw,
   (b) silently fall back to the default, or (c) fall back and `console.warn`?

   > a

4. **Name of the built-in default variant.**

   > 'polyhedron'

5. **Descriptor scope.** Reserve the hooks later waves need now, or define only the
   minimal identity/lookup shape and let each wave extend it?

   > whatever makes the project more likely to succeed in the long run

   Planner's resolution: the descriptor carries the identity fields (`id`, `label`,
   `spec`) **plus** the four hooks that map one-to-one onto the pipeline the codebase
   already has — `derive`, `describe`, `renderStatic`, `mount` — because each is an
   existing exported function of `src/core.js` and so the `polyhedron` descriptor can
   be bound without touching core. Hooks with no current implementation (motion
   profiles, reduced-motion overrides, geometry bounds) are **not** reserved; adding a
   speculative field with no consumer is what the descriptor validator would have to
   accept forever. Later waves add fields through `defineVariant()` validation, which is
   the single place the shape is enforced.

## Research

Skills consulted: modern-javascript-patterns, vercel-react-best-practices

**Lint baseline (policy §5).** AGENTS.md declares `Lint: none` and `Typecheck: none`;
the only verification command is `npm test` (`node --test test/*.test.js`,
[package.json](../../../../package.json) `scripts`). There is no ESLint, Prettier,
tsconfig, or CI workflow in the repository (`.github/` contains only `agento.json`).
Recorded baseline on this worktree at `origin/main` (`7ebe9b5`):

- First run *before* `npm ci`: `npm test` exit 1 — `ERR_MODULE_NOT_FOUND: Cannot find
  package 'jsdom'` in `test/prismicon.test.js`. Cause: fresh worktree without
  `node_modules`, not a code defect.
- After `npm ci` (exit 0): `npm test` exit 0 — **13 tests, 13 pass, 0 fail**
  (1 in `test/derivation-freeze.test.js`, 12 in `test/prismicon.test.js`).

Overlap decision: no lint findings exist, so there is nothing to clean up and no
scoped gate to construct; the complete gate for this delivery is the full `npm test`
run (all existing tests plus the new `test/variants.test.js`), which the roadmap and
acceptance checklist require to stay green.

**Codebase findings (evidence: file paths and lines).**

- Public entry [src/index.js](../../../../src/index.js) re-exports exactly 11 names
  from `./core.js`: `SPEC_VERSION`, `STATES`, `PALETTE`, `SIDE_NAMES`, `SOLID_NAMES`,
  `FINISH_NAMES`, `normalizeSeed`, `deriveV1`, `describeParams`, `renderStaticSVG`,
  `mountGlyph`. [index.d.ts](../../../../index.d.ts) (68 lines) declares precisely
  these plus the React module; it is hand-maintained.
- [src/core.js](../../../../src/core.js) (486 lines) is the whole engine. The rendering
  pipeline is `deriveV1(seed)` → `buildSolid(type, n, prop)` → `renderInner(p, geo,
  ori, opts)`; `renderStaticSVG` (lines 262–275) and `mountGlyph` (lines 410–486) both
  run it inline with option defaults (`size || 64`, `kind || 'agent'`) applied inline —
  there is no central options normalizer. The header comment (lines 1–12) freezes the
  v1 draw order; `SPEC_VERSION = 'v1'` (line 16) is stamped into `GlyphParams.spec`.
- Module-level mutable state is limited to the animation engine singleton
  `let engine = null` (line 223) created lazily by `getEngine()`; it holds `instances`,
  `reduced`, the `IntersectionObserver`, and the rAF loop flags. No registries or
  lookup tables are mutable; constants are `const` but not `Object.freeze`d.
- [src/react.js](../../../../src/react.js) imports only `renderStaticSVG` and
  `mountGlyph` (line 14), renders the static markup once via `useRef` for SSR/first
  paint, then mounts in `useEffect` keyed on `[seed, size, kind, dark]` and calls
  `setState` in a second effect keyed on `[state]`. Any future `variant` prop belongs in
  the first dependency list — a wave 3 concern, noted so the reserved key fits.
- [test/derivation-freeze.test.js](../../../../test/derivation-freeze.test.js) holds
  the `FROZEN` fixture for seeds `maya`, `build-bot-7`, `Alice@X.com` and
  `deepEqual`s `deriveV1` output; [test/prismicon.test.js](../../../../test/prismicon.test.js)
  builds a JSDOM with mocked `matchMedia`, `requestAnimationFrame`, and no
  `IntersectionObserver`, and asserts on aria-labels, ring attributes, and frame
  counts rather than SVG snapshots. Test style: `node:test` + `node:assert/strict`,
  ESM imports from `../src/…`.
- [package.json](../../../../package.json): `"type": "module"`, `"sideEffects": false`,
  `files: ["src", "index.d.ts", "README.md", "LICENSE"]`, exports `.` and `./react`
  only, zero runtime dependencies, React optional peer. New files under `src/` ship
  automatically; new exports subpaths would require an `exports` change (not needed).
- [README.md](../../../../README.md) documents the public API, the frozen derivation
  spec, and performance; it never mentions variants or styles.
  [demo/index.html](../../../../demo/index.html) imports from `../src/index.js`.
- Code style in `src/`: 2-space indent, single quotes, semicolons, `const` by default,
  `function` declarations for named functions, block-comment JSDoc on exports,
  UPPER_SNAKE constants, `// ----- section` dividers.

**Skill guidance applied.**

- *modern-javascript-patterns*: pure functions, `const`, module boundaries, immutable
  data (`Object.freeze` on descriptors and registries), `Map` for id lookups, explicit
  error handling with typed errors (`TypeError` for bad input, `RangeError` for
  unknown ids), small single-purpose functions.
- *vercel-react-best-practices*: `server-no-shared-module-state` — no mutable
  module-level registry that SSR requests could mutate; registries are immutable
  values created from static descriptor lists. `bundle-analyzable-paths` and the
  package's `sideEffects: false` — built-in registration is a static import graph, not
  an import-time `register()` side effect, so unused variants stay tree-shakeable.
  `js-set-map-lookups` — `Map`-backed `has/get`.

**Concurrent delivery.** `gh pr list --state open` returned `[]`; no other delivery
branch exists, so there is no file overlap to sequence around.

**Slug reservation.** `agento.mjs find variant-registry-contract` → `status: missing`;
no local or `origin/` branch `feature/variant-registry-contract` existed before this
plan created it from detached `origin/main`.

## Approach

Add an internal `src/variants/` module tree; change nothing else in `src/`.

**`src/variants/registry.js`** — the contract; imports nothing from `core.js` so a
future dispatcher (wave 2) can import it without a cycle.

- `VARIANT_ID_PATTERN = /^[a-z][a-z0-9-]*$/` — ids are stable, URL/prop-safe tokens.
- `defineVariant(descriptor)` — validates and returns a frozen descriptor. Required:
  `id` (matches the pattern), `label` (non-empty string), `spec` (non-empty string, the
  derivation spec the variant's identities are frozen under — `'v1'` for polyhedron),
  and functions `derive(seed)`, `describe(params)`, `renderStatic(seed, opts)`,
  `mount(el, seed, opts)`. Unknown keys are rejected so the shape stays explicit.
  Throws `TypeError` with the offending field named.
- `createVariantRegistry(descriptors, { defaultId })` — accepts an array of descriptors
  (each passed through `defineVariant`), rejects duplicate ids and a `defaultId` not in
  the list, and returns a frozen object: `ids` (frozen array in registration order),
  `defaultId`, `has(id)`, `get(id)`, `resolve(key)`. `get` of an unknown id throws
  `RangeError` `Unknown prismicon variant "<id>"; registered: <ids>`. `resolve(key)`
  is the per-icon selection contract: `undefined`/`null` → the default descriptor;
  a string → `get(key)`; anything else → `TypeError`. No mutation API exists on a
  registry — adding variants means creating a new registry from a longer list, which
  is what custom-variant-authoring (wave 3) will expose.
- JSDoc `@typedef VariantDescriptor` and a module header documenting: the reserved
  per-icon option key `variant` (consumed by waves 2–3, not read by this wave), the
  fallback rule (absent → default, unknown → throw), and that `spec` must change when a
  variant's seed-derived identities change.

**`src/variants/polyhedron.js`** — `export const polyhedron = defineVariant({ id:
'polyhedron', label: 'Polyhedron', spec: SPEC_VERSION, derive: deriveV1, describe:
describeParams, renderStatic: renderStaticSVG, mount: mountGlyph })`, importing those
names from `../core.js`. Binding the existing exports directly is what guarantees
byte-identical default output.

**`src/variants/index.js`** — `DEFAULT_VARIANT_ID = 'polyhedron'`,
`BUILT_IN_VARIANTS = createVariantRegistry([polyhedron], { defaultId })`, and
`resolveVariant(key, registry = BUILT_IN_VARIANTS)`; re-exports `defineVariant`,
`createVariantRegistry`, `VARIANT_ID_PATTERN`.

**`test/variants.test.js`** (new) — `node:test` + `node:assert/strict`, matching the
existing files. Covers: descriptor validation (bad id, missing/non-function hooks,
unknown keys, frozen result); registry (duplicate ids, unknown `defaultId`, `ids`
order, `has`/`get`, `resolve` fallback and throw, non-string key); `polyhedron`
parity — `derive` deep-equals the `FROZEN` fixture seeds and `renderStatic(seed,
opts)` string-equals `renderStaticSVG(seed, opts)` for those seeds across
`{ size, kind, state, dark }` combinations; and a public-surface guard asserting
`Object.keys(await import('../src/index.js')).sort()` equals the current 11 names.

**Untouched, verified by diff:** `src/index.js`, `src/core.js`, `src/react.js`,
`index.d.ts`, `README.md`, `demo/index.html`, `package.json`. The variant module is
internal until wave 2 wires it into rendering; the roadmap's final verification
includes `git diff --quiet origin/main -- <those paths>`.

**Wave-2 hand-off note (not in scope):** because `polyhedron.js` imports `core.js`, a
wave-2 dispatcher must live in a module that `core.js` does not import (e.g. the public
entry delegating to `resolveVariant(opts.variant).renderStatic(...)`), or the cycle
must be broken by making `core.js` the polyhedron implementation only.

## Risks

- **Default output drifts.** Mitigation: `polyhedron` binds existing functions rather
  than reimplementing them; parity tests compare against `renderStaticSVG`/`deriveV1`
  on the frozen seeds; `test/derivation-freeze.test.js` remains untouched and must
  pass.
- **Public API leaks early.** Mitigation: a test asserts the exact export list of
  `src/index.js`; `index.d.ts` and `README.md` are diff-checked against `origin/main`.
- **Import cycle when wave 2 routes core through the registry.** Mitigation:
  `registry.js` has no `core.js` import; the hand-off note above records the constraint
  for the `variant-renderer-integration` planner.
- **Descriptor shape too rigid or too loose for later waves.** Mitigation: unknown keys
  are rejected today so each new field is a deliberate, tested change in one validator;
  the shape mirrors the pipeline that exists rather than speculating.
- **Mutable global registry breaks SSR determinism.** Mitigation: registries are frozen
  values; no module-level `register()`; `sideEffects: false` is preserved.
- **Concurrent delivery.** No open PRs at planning time; still integrate `origin/main`
  before every push per policy §7.

## Out of scope

- Reading a `variant` option in `renderStaticSVG`, `mountGlyph`, or `Prismicon`
  (waves 2–3: `variant-renderer-integration`, `react-variant-selection`).
- Any export from `src/index.js`, `index.d.ts`, or `package.json` `exports`.
- README documentation of variants (deferred until there is a public surface).
- Consumer registration API, validation tooling, or a second variant
  (`custom-variant-authoring`, `variant-build-tooling`, `ncube-geometry-family`).
- Changes to the animation engine, reduced-motion behavior, or the v1 derivation.

## Acceptance checklist

- [ ] `npm test` exits 0 with all 13 baseline tests plus every test in
  `test/variants.test.js` passing (verify: `npm test` output `# fail 0`).
- [ ] `defineVariant` rejects an invalid `id`, a missing or non-function hook, an
  unknown key, and a non-string `label`/`spec` with `TypeError`, and returns a frozen
  descriptor (verify: assertions in `test/variants.test.js`).
- [ ] `createVariantRegistry` rejects duplicate ids and an unregistered `defaultId`;
  `ids` preserves registration order and is frozen (verify: `test/variants.test.js`).
- [ ] `resolve(undefined)` and `resolve(null)` return the `polyhedron` descriptor;
  `resolve('unknown')` throws `RangeError` whose message names the unknown id and lists
  registered ids; a non-string key throws `TypeError` (verify: `test/variants.test.js`).
- [ ] `BUILT_IN_VARIANTS.get('polyhedron').renderStatic(seed, opts)` equals
  `renderStaticSVG(seed, opts)` and `.derive(seed)` deep-equals the `FROZEN` fixture for
  `maya`, `build-bot-7`, `Alice@X.com` (verify: `test/variants.test.js`).
- [ ] `test/derivation-freeze.test.js` is unmodified and passes (verify: `git diff
  --quiet origin/main -- test/derivation-freeze.test.js && npm test`).
- [ ] Public surface unchanged: `src/index.js` exports exactly the 11 current names
  (verify: export-list test) and `src/index.js`, `src/core.js`, `src/react.js`,
  `index.d.ts`, `README.md`, `demo/index.html`, `package.json` have no diff from
  `origin/main` (verify: `git diff --quiet origin/main -- <paths>`).
- [ ] `src/variants/registry.js` imports nothing from `core.js` (verify: `grep -c
  "core.js" src/variants/registry.js` prints `0`).
- [ ] No mutable module-level registry state and no import-time registration side
  effects; `package.json` `sideEffects: false` untouched (verify: code review of
  `src/variants/*.js` + `package.json` diff empty).
- [ ] `npm pack --dry-run` lists `src/variants/registry.js`, `src/variants/polyhedron.js`,
  `src/variants/index.js` (verify: command output).
- [ ] Lint gate: no lint is configured (AGENTS.md); the complete gate is the full
  `npm test` run compared with the recorded baseline (13 pass → 13 + new pass, 0 fail)
  (verify: `npm test`).
