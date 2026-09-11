# Review: custom-variant-authoring

Verdict: approve

Reviewed at `62ecfec` (`feature/custom-variant-authoring`, draft PR #11, `mergeStateStatus:
CLEAN`, `origin/main` `1235225` is an ancestor of `HEAD`). `gh pr list --state open` shows
only PR #11, so no concurrent delivery touches these files. Skills consulted:
modern-javascript-patterns, vercel-react-best-practices.

**Gate rerun vs the plan.md `## Research` baseline** (all run fresh in this worktree after
`npm ci`):

| Check | Baseline (`origin/main`) | This branch | Result |
|---|---|---|---|
| `npm test` | `# tests 86`, `# pass 86`, `# fail 0` | `# tests 111`, `# suites 9`, `# pass 111`, `# fail 0` | pass (+25, ≥ 110) |
| `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts` | exactly one `TS7016` for `'react'` | exactly one `TS7016` for `'react'` (`index.d.ts(226,63)`) | pass, unchanged |
| `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures` | exit 0 | exit 0 | pass |
| `git diff --quiet origin/main -- src/core.js src/variants/registry.js src/variants/polyhedron.js src/variants/ncube.js` | n/a | exit 0 | pass |
| `npm pack --dry-run` | n/a | lists `index.d.ts`, `src/authoring.js`, `src/variants/validate.js`; `grep -cE "demo/|test/"` → `0` | pass |
| Lint | none configured (`Lint: none`, `Typecheck: none`) | none configured | n/a, no overlap possible |
| `git status --porcelain` | — | empty before the review commit | pass |

## Acceptance checklist results

1. **Root exports resolve** — pass. `node -e "import('./src/index.js').then(m => console.log([...].every(k => k in m)))"` printed `true`; [test/variants.test.js](../../../../test/variants.test.js#L275-L300) asserts the sorted eighteen-name list and passes (`node --test test/variants.test.js` inside the 111/111 run).
2. **`validateVariant` accepts square + built-ins, rejects the four bad hooks with `TypeError` naming id/probe/hook** — pass. [test/authoring.test.js](../../../../test/authoring.test.js#L65-L129) covers `square`, every `BUILT_IN_VARIANTS` descriptor, `Math.random` paint (`/Variant "bad".*determinism.*paint/`), `window` derive (`/Variant "bad".*"derive".*"window"/`), empty `describe`, numeric `flash`; `node --test test/authoring.test.js` → `# tests 20`, `# fail 0`. Independent probe: a hook throwing a string is reported as `Variant "thrower" hook "geometry" threw during validation: boom`.
3. **`globalThis` unchanged after passing and failing SSR probes** — pass. [test/authoring.test.js](../../../../test/authoring.test.js#L131-L152) compares `Object.getOwnPropertyDescriptor` for `window, document, navigator, matchMedia, requestAnimationFrame` before/after in no-DOM, DOM-installed, and failing cases; my own plain-Node probe confirmed `window`/`document` stay absent and `navigator` stays present after `validateVariant(square)`.
4. **`createPrismicon({ variants: [square] })` instance behaviour, duplicate/shadow, `builtIns: false`, `validate: false`** — pass. [test/authoring.test.js](../../../../test/authoring.test.js#L154-L241): frozen instance, ids `[...builtInIds, 'square']`, `<rect` in static output, `<rect transform` changes after one `requestAnimationFrame`, `/Duplicate prismicon variant id/` for `id: 'polyhedron'` and for `[square, square]`, `/Default variant "polyhedron" is not registered/` for `builtIns: false`, `validate: false` accepts `randomPaint` while still rejecting a non-function `paint`, non-array `variants` → `TypeError`.
5. **Parity with module-level `renderStaticSVG` for every built-in id and golden seed; golden diff empty** — pass. [test/authoring.test.js](../../../../test/authoring.test.js#L155-L168) loops `STATIC_SEEDS × builtInIds`; `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures` → exit 0.
6. **React provider cases** — pass. [test/react-variant.test.js](../../../../test/react-variant.test.js#L147-L242): SSR markup inside `PrismiconProvider` contains `instance.renderStaticSVG('maya', props)`; no-provider tree throws `RangeError` matching `/square/`; client mount renders `<rect>` with `aria-label` `maya: square maya, working`; same registry identity keeps the same `<svg>` node, a second registry swaps it (one `<svg>` total, `, working` preserved); `registry={{}}` surfaces `TypeError: PrismiconProvider "registry" must be a variant registry` via `onUncaughtError`; export list equals `['Prismicon', 'PrismiconProvider', 'default']`. `node --test test/react-variant.test.js` → `# tests 13`, `# fail 0`.
7. **`index.d.ts` declares the ten symbols; tsc reports exactly the one pre-existing `'react'` TS7016** — pass. `grep -c` per symbol: `VariantDescriptor=9 VariantRegistry=6 PrismiconInstance=2 validateVariant=3 createPrismicon=2 defineVariant=1 createVariantRegistry=1 VARIANT_ID_PATTERN=2 PrismiconProvider=2 PrismiconProviderProps=2`; tsc → `1` error, `index.d.ts(226,63): error TS7016 ... 'react'`.
8. **Frozen render path untouched; pack contents** — pass. `git diff --quiet origin/main -- src/core.js src/variants/registry.js src/variants/polyhedron.js src/variants/ncube.js` → exit 0; `npm pack --dry-run` lists `src/authoring.js` and `src/variants/validate.js`, zero `demo/` or `test/` entries.
9. **README `## Custom variants` placement and coverage** — pass. `grep -n "^## " README.md` → `108:## Variants`, `197:## Custom variants`, `380:## Derivation spec v1 (frozen)` consecutive; `grep -c "createPrismicon\|validateVariant\|PrismiconProvider" README.md` → `17` (≥ 6); `grep -c defineVariant` → `5`. Section covers descriptor table, eight-hook table with call timing, reduced-motion rule, `spec` versioning, both probes and the error shape, `createPrismicon` options table with duplicate/shadowing and hoisting, `PrismiconProvider` (nesting, remount, `TypeError`), and the square excerpt ([README.md](../../../../README.md#L197-L379)).
10. **Demo at `local:3115`** — pass, re-driven independently. `python3 -m http.server 3115 --directory .` (port confirmed free first; `agento.mjs ports custom-variant-authoring` → `WEB_PORT: 3115`), Chromium at `http://localhost:3115/demo/index.html`: hero `<select>` options `["Polyhedron","N-cube","3-cube (cube)","4-cube (tesseract)","5-cube (penteract)","6-cube (hexeract)","Square"]`; selecting `Square` mounts `aria-label="demo-agent: square demo-agent, working"` with a `<rect>` whose `transform` advanced `rotate(182.0 50 50)` → `rotate(215.0 50 50)` over 400 ms; `#custom` holds three `<svg>` each with one `<rect>` labelled `idle`/`working`/`done`; `#dimensions` still renders 3-cube…6-cube; zero console errors/warnings/page errors across load and selection. My screenshot: [evidence/review-demo-custom-variant.png](evidence/review-demo-custom-variant.png) (body zoom 0.6 for capture only, same viewport-only quirk the Builder noted). The Builder's [evidence/step-5-2-demo-custom-variant.png](evidence/step-5-2-demo-custom-variant.png) exists (68 122 bytes) and is linked from step 5.2. Server stopped afterwards (`ss -ltn | grep -c ':3115 '` → `0`).
11. **Complete gate** — pass. See the table above: `# fail 0`, `# tests 111` ≥ 110; tsc one pre-existing error; golden diff empty; `git status --porcelain` empty at `62ecfec`.

## Plan vs implementation

- **Matches the plan's contract.** `validateVariant` ([src/variants/validate.js](../../../../src/variants/validate.js)) does shape → SSR probe → determinism probe over `DEFAULT_SEEDS` (= `STATIC_SEEDS`), both `dark` values, `PROBE_STATES` (= `[...STATES, 'settling']`, pinned by test), one `animate` step with `dt: 1/60`, descriptor restore in `finally`, non-configurable globals skipped. `createPrismicon` ([src/authoring.js](../../../../src/authoring.js)) is the pure factory described in Approach item 2. `src/react.js` reads context with a frozen module-level `DEFAULT_CONTEXT` fallback, memoises the provider value on `[registry]`, and adds `ctx` to the mount-effect deps ([src/react.js](../../../../src/react.js#L17-L38), [L63-L81](../../../../src/react.js#L63-L81)).
- **Type name deviation (documented in roadmap, not in plan).** Approach item 5 names `VariantHookEffects`; the shipped interface is `VariantPaintEffects` ([index.d.ts](../../../../index.d.ts#L111-L117)). Roadmap step 4.1 already records the shipped name; the acceptance checklist does not name this type, so nothing scored depends on it.
- **Probe order.** Plan lists the SSR pipeline as `derive → prepare → geometry → pose('idle') → describe → paint`; the implementation runs `describe` right after `derive` ([validate.js](../../../../src/variants/validate.js#L108-L118)). Same hook set, no behavioural difference.
- **Probe calls hooks with `'settling'` that the engine never uses for `flash`/`pose`.** The engine only calls `pose(p, 'idle' | 'working')` and `flash(p, <public state>)` ([src/core.js](../../../../src/core.js#L101-L102), [L142-L147](../../../../src/core.js#L142-L147)), but the probe calls `pose` and `flash` with every `PROBE_STATES` entry including `'settling'` ([validate.js](../../../../src/variants/validate.js#L122-L129)). The plan asked for this (`pose(params, state)` for every state plus `'settling'`), so it is not a deviation, but see Findings 2 for the type mismatch it creates.
- **Undocumented changes:** none. Every changed file is in the plan's affected-files list.

## Roadmap audit

Every ticked box was spot-checked against the codebase and commit history:

- 1.1 (`6ff185b`) touches only roadmap.md; baseline numbers match plan `## Research`.
- 1.2 (`428235b`) adds only `test/authoring.test.js` — `git show --stat | grep -c "^ src/"` → `0`, honouring "commit before any `src/` change".
- 1.3 (`618b9f2`) touches only `test/react-variant.test.js`.
- 2.1, 2.2, 3.1, 4.1–4.4: the named files exist with the described content; each step's `verify:` grep/tsc/test command was rerun above and passes.
- 5.1: gate rerun matches (table above).
- 5.2: linked evidence file present with a completion date on the line; target re-driven by me with matching observations.
- 5.3: `git log origin/feature/custom-variant-authoring -1 --format=%s` → `chore(roadmap): hand custom-variant-authoring to review (5.3)`.

No falsely ticked boxes; no missing-work steps needed; no `(manual)` or `(manual, post-ship)` steps. No repairs made.

## Findings

Ordered by severity. None above minor.

1. **Minor — SSR probe rejects the `typeof window !== 'undefined'` guard, and the README does not say so.** Because the probe installs *throwing accessors* rather than deleting the globals, `typeof window` invokes the getter and throws. Verified: a `derive` that does `typeof window !== 'undefined' ? window.innerWidth : 0` is rejected with `Variant "guarded" hook "derive" accessed browser global "window" during static rendering`, although core.js itself uses that exact idiom for its engine ([src/core.js](../../../../src/core.js#L177)). This is arguably the *right* behaviour for static output (an environment-dependent branch would cause a hydration mismatch), but an author following the common SSR idiom will be surprised. Recommend one sentence in README `### Validating a variant` ([README.md](../../../../README.md#L237-L268)): "`typeof window` guards also fail the probe — static-path hooks must not read browser globals at all."
2. **Minor — `VariantDescriptor.flash` is typed `state: GlyphState` but the probe calls it with `'settling'`.** [index.d.ts](../../../../index.d.ts#L159) vs [validate.js](../../../../src/variants/validate.js#L126). A TypeScript author who switches exhaustively on `GlyphState` in `flash` (e.g. `assertNever`) would pass tsc yet throw during `validateVariant`. Either type it `GlyphState | 'settling'` (matching `pose`) or skip `'settling'` for `flash` in the probe. No runtime impact for the JS square example.
3. **Minor — `VariantPaintEffects.dark: boolean` is not what static renders pass.** `renderStaticSVG` forwards `opts.dark` unnormalised ([src/core.js](../../../../src/core.js#L81)), so a custom `paint` receives `undefined` when the caller omits `dark`. The runtime is pre-existing and frozen; the new declaration ([index.d.ts](../../../../index.d.ts#L112)) should read `dark?: boolean` or the JSDoc should say "falsy when unset".
4. **Informational — test fixture now depends on `demo/`.** [test/fixtures/square-variant.js](../../../../test/fixtures/square-variant.js#L13) re-exports `../../demo/square-variant.js`, so editing the demo example changes dispatch-test inputs. This is the plan's explicit intent (documented example = example under test) and `npm pack` excludes both directories; noting it so a future demo tweak is treated as a test change.
5. **Skill conformance — no issues.** modern-javascript-patterns: `const` throughout, pure functions, `Object.freeze` on every returned surface, `finally`-based restoration, no shared mutable state (`createPrismicon` twice → independent registries, asserted in test). vercel-react-best-practices: provider value memoised on registry identity (`rerender-dependencies`), default context is a hoisted frozen constant so the no-provider effect deps are stable (`rerender-memo-with-default-value`), no new entry point or import-time work, `sideEffects: false` intact (`bundle-*`), no module-level request state (`server-no-shared-module-state`). Security: no user input reaches `innerHTML` beyond what the frozen render path already did; the SSR probe only redefines a fixed allow-list of names and restores descriptors even on throw.

## Follow-ups

- Document that `typeof`-guarded browser-global reads fail the SSR probe (Finding 1) — one README sentence, could ride along with `variant-build-tooling`.
- Align the `flash` hook type with the probe's `'settling'` call, or exclude `'settling'` from the `flash` probe (Finding 2).
- Mark `VariantPaintEffects.dark` optional or document the `undefined` case (Finding 3).
- `demo/index.html` still imports `deriveV1`/`describeParams` for the polyhedron-only console helper; a later demo pass could route it through `prismicon.registry.get(id).derive` so the page is fully registry-driven. Cosmetic, not in this feature's scope.
