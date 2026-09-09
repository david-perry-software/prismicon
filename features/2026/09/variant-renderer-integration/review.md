# Review: variant-renderer-integration

Verdict: request-changes

Reviewed at `5520843` (`feature/variant-renderer-integration`, PR #8 draft) against
`origin/main` `ec81fac` (confirmed ancestor of `HEAD` via `git merge-base
--is-ancestor`, exit 0; this worktree owns the branch per `git worktree list`; `git
status --porcelain` empty). Skills consulted: modern-javascript-patterns (pure
functions, immutable data, explicit typed errors at the boundary),
vercel-react-best-practices (`server-no-shared-module-state`,
`bundle-analyzable-paths`, `js-early-exit`; `src/react.js` is untouched). All
commands below were run by the reviewer in this worktree on 2026-09-08. Concurrent
delivery: `gh pr list --state open` returns only PR #8 itself.

Change set (`git diff --stat origin/main...HEAD`): 18 files, +2513/−417. Source:
`src/core.js`, `src/index.js`, `src/variants/{index,polyhedron,registry}.js`,
`index.d.ts`, `README.md`, `demo/index.html`. Tests/tooling: `test/helpers/golden.js`,
`test/fixtures/{golden-v1.json,square-variant.js}`, `test/golden-v1.test.js`,
`test/renderer-dispatch.test.js`, `test/variants.test.js`, `scripts/generate-golden.mjs`.
Evidence: `evidence/step-5-2-demo-variant-select.png`.

## Acceptance checklist results

Tally: 16 pass / 0 fail / 0 deferred. (The blocking finding below is a deviation from
the plan's `## Approach` and roadmap step 3.1 that the checklist does not directly
enumerate; see Findings.)

1. **`npm test` exits 0, `# fail 0`, ≥ 32 baseline + new** — PASS. `npm ci && npm
   test` → exit 0, `# tests 47`, `# pass 47`, `# fail 0` (1 derivation-freeze, 1
   golden, 12 prismicon, 12 renderer-dispatch, 21 variants).
2. **Golden fixture generated from `src/` identical to `origin/main`; passes against
   final code** — PASS. `git log --oneline origin/main..HEAD -- src test/fixtures`
   shows `2fc35d1 test(golden)` before every `src/` commit; `git show --name-only
   2fc35d1 -- src | grep -c "^src/"` → `0`. Regenerating on `HEAD`
   (`node scripts/generate-golden.mjs && cmp …`) → `IDENTICAL` (30 static, 5 mounted
   incl. reduced-motion). `node --test test/golden-v1.test.js` → 1/1.
3. **`test/prismicon.test.js`, `test/derivation-freeze.test.js`, `src/react.js`,
   `package.json` unchanged** — PASS. `git diff --quiet origin/main -- …` → exit 0.
4. **`defineVariant` requires the seven hooks, rejects `renderStatic`/`mount` as
   unknown** — PASS. [src/variants/registry.js](../../../../src/variants/registry.js#L43-L45)
   `HOOK_NAMES`/`KNOWN_KEYS`; [test/variants.test.js](../../../../test/variants.test.js#L64-L80)
   iterates all seven for missing/non-function; unknown-key test at L82. (`renderStatic`
   is rejected because it is not in `KNOWN_KEYS` — covered by the unknown-key path,
   though not asserted by name; nit below.)
5. **`renderStaticSVG(seed, { variant: 'polyhedron' }) === renderStaticSVG(seed)` for
   `PARITY_OPTS` × frozen seeds** — PASS. [test/variants.test.js](../../../../test/variants.test.js#L213-L220), `ok`.
6. **Square fixture: static `<rect>` + ring + aria-label; `user` no ring/suffix;
   mounted `working` changes geometry; `setState` updates ring/aria; reduced motion → 0
   rAF, static geometry, ring updates; `destroy()` empties host** — PASS.
   [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js) tests
   1–6 all `ok`. Note: the static test uses `state: 'waiting'` (ring `0.1 9`) rather
   than the roadmap's literal `working`, which has no ring; the roadmap text was
   self-inconsistent, the test is correct.
7. **Unknown id → `RangeError` naming id + registered ids from both entry points;
   host untouched; non-string → `TypeError`; default renderer rejects `'square'`** —
   PASS *for the custom-registry renderer under test* ([test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L118-L148)).
   See Finding 1: the **public** default renderer does not honour the `TypeError`
   half of this contract.
8. **`handle.variant` equals resolved id for default and non-default** — PASS.
   [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L150-L160);
   implementation [src/core.js](../../../../src/core.js#L152) getter.
9. **Two `createRenderer` renderers share one engine / one rAF chain** — PASS.
   [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L162-L183)
   asserts exactly one pending frame after two mounts and both glyphs advance on it.
   (Uses a cache-busting import to obtain a fresh engine — see Observation.)
10. **`src/index.js` exports exactly 11 + `DEFAULT_VARIANT_ID` + `listVariants`;
    `listVariants()` frozen and equal to the polyhedron record** — PASS.
    [test/variants.test.js](../../../../test/variants.test.js#L237-L259) `ok`;
    [src/variants/index.js](../../../../src/variants/index.js#L25-L30) freezes the array
    and each record.
11. **No `src/variants/*` imports `core.js`** — PASS. `grep -c "core.js"` → `0`, `0`,
    `0` for `index.js`, `polyhedron.js`, `registry.js`.
12. **`index.d.ts` declares the five additions; `tsc --strict` clean except the
    pre-existing `react` import** — PASS (substance). `tsc` on `HEAD` → exactly one
    diagnostic, TS7016 on `import type … from 'react'` (L66). `tsc` on
    `origin/main:index.d.ts` → exactly one diagnostic on the same import (TS2307 when
    resolved outside `node_modules`). No new diagnostics. The roadmap's literal `grep
    -v "Cannot find module 'react'" | wc -l` prints `2`, not `0`, because the wording
    differs with `node_modules` present — verify text corrected in the roadmap.
    `grep -c "variant" index.d.ts` → `5`.
13. **README `## Variants` documents per-icon `variant`, `listVariants()`,
    `DEFAULT_VARIANT_ID`, throw-on-unknown** — PASS. `grep -n "^## …"` → `Vanilla API`
    L88, `Variants` L107, `Derivation spec v1` L128; all four topics present in
    [README.md](../../../../README.md#L107-L126).
14. **Demo `<select>` from `listVariants()` remounts hero; `local:3128` loads without
    console errors, lists `polyhedron`, remount keeps aria-label state** — PASS.
    `grep -c "listVariants" demo/index.html` → `2`; `grep -c 'id="variant"'` → `1`.
    Reviewer re-drove `http://127.0.0.1:3128/demo/index.html` (`python3 -m http.server
    3128 --bind 127.0.0.1`): console shows only `variant: polyhedron anatomy: …`, no
    errors; `#variant` has exactly one option `Polyhedron` (selected); hero aria-label
    ends `, working`; clicking `done` → `, done`; dispatching `change` on `#variant`
    replaces the `<svg>` node (outerHTML differs) and aria-label still ends `, done`.
    Screenshot committed at
    [evidence/step-5-2-demo-variant-select.png](evidence/step-5-2-demo-variant-select.png)
    (58 981 B). Server stopped afterwards.
15. **`npm pack --dry-run` lists the six `src/` files and nothing from `test/` or
    `scripts/`** — PASS. Output: `src/core.js`, `src/index.js`, `src/react.js`,
    `src/variants/index.js`, `src/variants/polyhedron.js`, `src/variants/registry.js`;
    no `test/` or `scripts/` lines.
16. **Lint gate** — PASS. AGENTS.md: `Lint: none`, `Typecheck: none`. Complete gate =
    `npm test`: baseline 32 pass / 0 fail → 47 pass / 0 fail. No lint findings exist to
    reconcile.

## Plan vs implementation

Matches `## Approach` in module layout, hook contract v2, engine `step` order (animate →
settle/transient transitions → flash → single DOM write), `handle.variant`, public
exports, README placement, and demo behaviour. Deviations:

- **Not implemented as planned:** `src/core.js` was to "import `./variants/index.js`
  (for `BUILT_IN_VARIANTS`)" and bind the public renderer to it. Instead
  [src/core.js](../../../../src/core.js#L76-L98) declares a local `polyhedron` object
  and a hand-rolled `BUILT_IN_VARIANTS = { defaultId, resolve(key) }` shim. See
  Finding 1.
- **Out of scope, added anyway:** `index.d.ts` adds `variant?: string` to
  `PrismiconProps` ([index.d.ts](../../../../index.d.ts#L71-L72)) while `src/react.js`
  ignores the prop. Plan `## Out of scope`: "`variant` prop on the React component
  (`react-variant-selection`)". See Finding 2.
- Benign: `handle.variant` is a getter rather than a data property (both read-only in
  practice; matches `readonly variant: string` in `index.d.ts`).
- Benign: the wave-1 follow-up about descriptor identity remains open —
  `BUILT_IN_VARIANTS.get('polyhedron') === polyhedron` → `false` (re-verified);
  `createVariantRegistry` still re-copies. Carried forward in Follow-ups.

## Roadmap audit

Spot-checked all ticked steps against the codebase and the commands above.

- 1.1 / 1.2: harness, generator, fixture, and test present; fixture predates `src/`
  changes; regenerates identically. Ticks stand.
- 2.1 / 2.2: `src/core.js` is variant-agnostic; polyhedron code lives in
  `src/variants/polyhedron.js` with zero `core.js` references; golden + prismicon green.
  Ticks stand.
- 2.3: `HOOK_NAMES` v2, header/typedefs document `ctx`/`effects`/`ctx.rest`;
  `export const polyhedron = defineVariant({...})` at the bottom of `polyhedron.js`;
  `listVariants` added; `variants/index.js` no longer imports `core.js`. Tick stands.
- **3.1 — falsely ticked → unticked.** `createRenderer` exists and the
  `RangeError true` verify prints as stated, but "the default renderer over
  `BUILT_IN_VARIANTS`" is not met: `src/core.js` never imports
  `./variants/index.js` (`grep -c "variants/index.js" src/core.js` → `0`).
- **3.3 (added 2026-09-08)** — new step to bind the default renderer to the real
  registry, remove the shim and dead hook imports, and add public-entry
  `TypeError`/`RangeError` tests; verify commands listed in the roadmap.
- 3.2: fixture and 12 dispatch tests present and green. Tick stands.
- 4.1: exports and guard updated; `listVariants()` asserted frozen/equal. Tick stands.
- 4.2: substance verified (single pre-existing `react` diagnostic); the literal verify
  command printed `2` not `0` at the time of ticking. Tick stands; **verify text
  corrected** to count `error TS` lines (`1`, naming `'react'`).
- 4.3: section present and correctly positioned. Tick stands.
- 5.1 / 5.2: grep counts and browser assertions reproduced by the reviewer; screenshot
  committed. Ticks stand.
- **6.1 / 6.2 — unticked**: the complete gate and hand-off must be re-run after 3.3
  changes `src/core.js`.
- Header: `status: in-review` kept; `next-step` set to 3.3; `last-updated` corrected to
  2026-09-08 (it read 2026-09-09).

No `(manual)` or `(manual, post-ship)` steps exist; step 5.2's browser evidence is a
committed screenshot re-driven by the reviewer.

## Findings

- **Major** — The public default renderer is not bound to the real registry.
  [src/core.js](../../../../src/core.js#L76-L98) hard-codes a `polyhedron` descriptor
  literal and a `BUILT_IN_VARIANTS` shim with its own `resolve(key)`, and L195 builds
  the exported `renderStaticSVG`/`mountGlyph` from that shim. Consequences, each
  verified:
  1. Two sources of truth. `listVariants()` reads the registry in
     [src/variants/index.js](../../../../src/variants/index.js#L10); the public
     renderer dispatches through the shim. The first wave that adds a built-in
     (`ncube-geometry-family`) would see it listed by `listVariants()` yet rejected by
     `renderStaticSVG(seed, { variant })` — the exact failure mode this feature exists
     to remove ("make multiple package styles usable per icon through the core
     JavaScript API").
  2. Contract drift at the API boundary. Via `src/index.js`,
     `renderStaticSVG('x', { variant: 42 })` → `RangeError`; the registry (and the
     `index.d.ts`/README contract, and `test/renderer-dispatch.test.js` for custom
     registries) says non-string → `TypeError`. Reproduced: default renderer →
     `RangeError` for `42`, `{}`, `true`; `BUILT_IN_VARIANTS.resolve(42)` → `TypeError`.
  3. Dead weight: five hook imports (`prepareParams` … `paintFrame`) exist only to feed
     the shim; the shim duplicates `id`/`label`/`spec` that `defineVariant` already
     validates and freezes.
  The shim was a legitimate step-2.1/2.2 scaffold (while `variants/index.js` still
  imported `core.js`); step 2.3 removed that import, so the swap is now cycle-free
  (`core.js → variants/index.js → { registry.js, polyhedron.js → registry.js }`).
  **Fix:** roadmap step 3.3. Golden fixtures must remain byte-identical afterwards
  (the shim's hooks are the same functions the real descriptor binds, so they will).
- **Minor** — `index.d.ts` declares `PrismiconProps.variant?: string`
  ([index.d.ts](../../../../index.d.ts#L71-L72)) but `src/react.js` neither reads nor
  forwards it; a TypeScript consumer gets a silently ignored prop. Out of scope per the
  plan; remove the two lines and leave the addition to `react-variant-selection`.
- **Minor** — Roadmap 4.2's verify literal never printed `0` on this machine (TS7016
  wording vs the `TS2307` filter). Corrected in the roadmap; no code change.
- **Nit** — `test/variants.test.js` proves `renderStatic`/`mount` are rejected only via
  the generic unknown-key test (`motion`). Two explicit assertions naming
  `renderStatic` and `mount` would pin the v1→v2 break the plan calls out.
- **Nit** — In [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L41-L43)
  `animationFrames` returns the *pending* callback count (queue length), unlike the
  same-named *total* counter in `test/prismicon.test.js`. Correct for the assertions
  made here (nothing is drained before the `=== 0` check) but the name invites misuse.
- **Observation (pre-existing, not a regression)** — The engine's `running` flag is
  only cleared by the next `loop` tick when `instances` is empty; `destroy()` of the
  last instance leaves `running = true` until a frame fires. In browsers rAF always
  fires so this is benign, but under a mocked rAF a later `ensureRunning()` schedules
  nothing — which is why every mounted test (pre-existing and new) needs a
  cache-busting `import('../src/core.js?…')`. Not in scope; noted for the engine
  owner.

Security: the only caller-supplied strings reaching markup are `seed` (already in the
aria-label on `origin/main`, unchanged) and `variant`, which is only ever compared
against registry ids and interpolated into an error message. The demo `<select>` values
come from `listVariants()`, not user input. No new dependencies, I/O, or eval. Nothing
OWASP-relevant.

## Follow-ups

- (Blocking, roadmap 3.3) Bind the default renderer to `BUILT_IN_VARIANTS`, delete the
  shim, add public-entry `TypeError`/`RangeError` tests, re-run 6.1/6.2.
- Remove `PrismiconProps.variant` from `index.d.ts` until `react-variant-selection`.
- Carry-over from wave 1: descriptor identity is still not preserved through
  `createVariantRegistry` (`get('polyhedron') !== polyhedron`). Resolve or document
  id-based comparison before `react-variant-selection` keys effects on descriptors.
- Optional: explicit `renderStatic`/`mount` rejection assertions; rename the dispatch
  helper's `animationFrames` to `pendingFrames`.
