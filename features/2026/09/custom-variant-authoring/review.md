# Review: custom-variant-authoring

Verdict: approve

Reviewed at `ca49ee0` (`feature/custom-variant-authoring`, draft PR #11, `isDraft: true`,
`origin/main` `1235225` is an ancestor of `HEAD`; `gh pr list --state open` shows only PR #11,
so no concurrent delivery touches these files). This review supersedes the one written at
`62ecfec` (commit `051de96`), which approved with three minor findings; the Builder answered
them in Phase 6 (`507ddbf` roadmap, `de545c5` 6.1, `b0a7cf7` 6.2, `f765234` 6.3, `ca49ee0`
6.4). Skills consulted: modern-javascript-patterns, vercel-react-best-practices.

Since `62ecfec` the only non-artifact files that changed are `README.md` (+5/−2),
`index.d.ts` (+4/−3) and `test/authoring.test.js` (+49) — `git diff --stat 62ecfec..HEAD`.
No `src/` or `demo/` file changed, so every runtime observation from the prior review still
describes the code under review; each was nevertheless rerun below.

**Gate rerun vs the plan.md `## Research` baseline** (all run fresh in this worktree after
`npm ci`):

| Check | Baseline (`origin/main`) | This branch (`ca49ee0`) | Result |
|---|---|---|---|
| `npm test` | `# tests 86`, `# pass 86`, `# fail 0` | `# tests 114`, `# suites 9`, `# pass 114`, `# fail 0`, exit 0 | pass (+28, ≥ 114 per step 6.3) |
| `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts` | exactly one `TS7016` for `'react'` | exactly one `TS7016` for `'react'` (`index.d.ts(227,63)`) | pass, unchanged |
| `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures` | exit 0 | exit 0 | pass |
| `git diff --quiet origin/main -- src/core.js src/variants/registry.js src/variants/polyhedron.js src/variants/ncube.js` | n/a | exit 0 | pass — frozen render path untouched |
| `npm pack --dry-run` | n/a | lists `index.d.ts`, `src/authoring.js`, `src/variants/validate.js` + the eight pre-existing `src/` files; `grep -cE "demo/|test/"` → `0` | pass |
| Lint | none configured (`Lint: none`, `Typecheck: none`) | none configured | n/a, no overlap possible |
| `git status --porcelain` | — | empty at `ca49ee0` before this review's commit | pass |

## Acceptance checklist results

1. **Root exports resolve** — pass. `node -e "import('./src/index.js').then(m => console.log([...].every(k => k in m)))"` printed `true`; `node --test test/variants.test.js` → `# tests 24`, `# fail 0` (contains the sorted root-export assertion, [test/variants.test.js](../../../../test/variants.test.js#L275-L300)).
2. **`validateVariant` accepts square + built-ins, rejects the four bad hooks with `TypeError` naming id/probe/hook** — pass. [test/authoring.test.js](../../../../test/authoring.test.js#L70-L158) covers `square`, every `BUILT_IN_VARIANTS` descriptor, `Math.random` paint, `window` derive, empty `describe`, numeric `flash`, and now also the `typeof window`-guarded derive; `node --test test/authoring.test.js` → `# tests 23`, `# fail 0`. Independent plain-Node probe (no JSDOM, `'window' in globalThis` → `false` before and after): the guarded derive is rejected with `TypeError: Variant "guarded" hook "derive" accessed browser global "window" during static rendering`.
3. **`globalThis` unchanged after passing and failing SSR probes** — pass. [test/authoring.test.js](../../../../test/authoring.test.js#L160-L181) compares `Object.getOwnPropertyDescriptor` for `window, document, navigator, matchMedia, requestAnimationFrame` before/after in no-DOM, DOM-installed and failing cases; my plain-Node probe above confirmed `window` stays absent after a failing probe.
4. **`createPrismicon({ variants: [square] })` instance behaviour, duplicate/shadow, `builtIns: false`, `validate: false`** — pass. [test/authoring.test.js](../../../../test/authoring.test.js#L183-L290): frozen instance, ids `[...builtInIds, 'square']`, `<rect` in static output, `<rect transform` changes after one `requestAnimationFrame`, `/Duplicate prismicon variant id/` for `id: 'polyhedron'` and `[square, square]`, `/Default variant "polyhedron" is not registered/` for `builtIns: false`, `validate: false` accepts `randomPaint`, non-array `variants` → `TypeError`. All inside the 114/114 run.
5. **Parity with module-level `renderStaticSVG` for every built-in id and golden seed; golden diff empty** — pass. The parity loop over `STATIC_SEEDS × builtInIds` ([test/authoring.test.js](../../../../test/authoring.test.js#L184-L197)) passes; `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures` → exit 0.
6. **React provider cases** — pass. `node --test test/react-variant.test.js` → `# tests 13`, `# fail 0` ([test/react-variant.test.js](../../../../test/react-variant.test.js#L147-L242): SSR parity inside `PrismiconProvider`, `RangeError` without provider, client `<rect>` mount, registry swap remounts, `registry={{}}` → `TypeError`); `node -e "import('./src/react.js')..."` → `Prismicon,PrismiconProvider,default`.
7. **`index.d.ts` declares the ten symbols; tsc reports exactly the one pre-existing `'react'` TS7016** — pass. `grep -c` per symbol: `VariantDescriptor=9 VariantRegistry=6 PrismiconInstance=2 validateVariant=4 createPrismicon=2 defineVariant=1 createVariantRegistry=1 VARIANT_ID_PATTERN=2 PrismiconProvider=2 PrismiconProviderProps=2`; tsc → `1` error, `index.d.ts(227,63): error TS7016 ... 'react'`. Type-level check of the Phase 6 fixes with a throwaway consumer `.ts` compiled against `index.d.ts`: a `flash` that switches exhaustively over `GlyphState` only now fails with `TS2345: Argument of type '"settling"' is not assignable to parameter of type 'never'`, and `(e: VariantPaintEffects): boolean => e.dark` fails with `TS2322: Type 'boolean | undefined' is not assignable to type 'boolean'` — both prior findings are now enforced by the compiler.
8. **Frozen render path untouched; pack contents** — pass (table above).
9. **README `## Custom variants` placement and coverage** — pass. `grep -n "^## " README.md` → `108:## Variants`, `197:## Custom variants`, `383:## Derivation spec v1 (frozen)` consecutive; `grep -c "createPrismicon\|validateVariant\|PrismiconProvider" README.md` → `17`; `grep -c defineVariant` → `5`; `grep -c "typeof window"` → `1`; `grep -c "effects.dark"` → `1`.
10. **Demo at `local:3115`** — pass, re-driven independently at `ca49ee0`. `agento.mjs ports custom-variant-authoring` → `WEB_PORT: 3115`, confirmed free (`ss -ltn | grep -c ':3115 '` → `0`), then `python3 -m http.server 3115 --directory . --bind 127.0.0.1`; Chromium at `http://localhost:3115/demo/index.html`: hero `<select>` options `["Polyhedron","N-cube","3-cube (cube)","4-cube (tesseract)","5-cube (penteract)","6-cube (hexeract)","Square"]`; selecting `Square` mounts `aria-label="demo-agent: square demo-agent, working"` whose `<rect transform>` advanced `rotate(180.5 50 50)` → `rotate(216.5 50 50)` over 400 ms; `#custom` holds three `<svg>` each with one `<rect>` labelled `idle`/`working`/`done`; `#dimensions` renders 3-cube…6-cube; zero console errors/warnings/page errors across load, reload and selection. My screenshot: [evidence/review-2-demo-custom-variant.png](evidence/review-2-demo-custom-variant.png) (body zoom 0.6 for the capture only). The Builder's [evidence/step-5-2-demo-custom-variant.png](evidence/step-5-2-demo-custom-variant.png) (68 122 bytes) remains linked from step 5.2. Server stopped afterwards (`ss -ltn | grep -c ':3115 '` → `0`).
11. **Complete gate** — pass (table above).

## Plan vs implementation

- **Matches the plan's contract.** `validateVariant` ([src/variants/validate.js](../../../../src/variants/validate.js)) does shape → SSR probe → determinism probe over `DEFAULT_SEEDS` (= `STATIC_SEEDS`), both `dark` values, `PROBE_STATES` (= `[...STATES, 'settling']`, pinned by test), one `animate` step with `dt: 1/60`, descriptor restore in `finally`, non-configurable globals skipped. `createPrismicon` ([src/authoring.js](../../../../src/authoring.js)) is the pure factory described in Approach item 2. `src/react.js` reads context with a frozen module-level `DEFAULT_CONTEXT` fallback, memoises the provider value on `[registry]`, and adds `ctx` to the mount-effect deps ([src/react.js](../../../../src/react.js#L17-L38), [L63-L81](../../../../src/react.js#L63-L81)).
- **Type name deviation (documented in roadmap, not in plan).** Approach item 5 names `VariantHookEffects`; the shipped interface is `VariantPaintEffects` ([index.d.ts](../../../../index.d.ts#L111-L118)). Roadmap step 4.1 already records the shipped name; the acceptance checklist does not name this type, so nothing scored depends on it.
- **Probe order.** Plan lists the SSR pipeline as `derive → prepare → geometry → pose('idle') → describe → paint`; the implementation runs `describe` right after `derive` ([validate.js](../../../../src/variants/validate.js#L108-L118)). Same hook set, no behavioural difference.
- **Probe calls `pose`/`flash` with `'settling'`, which the engine never passes to `flash`.** Plan-mandated (`pose(params, state)` for every state plus `'settling'`); after 6.2 the declared `flash` signature now matches the probe, so the type/probe mismatch the prior review flagged is gone.
- **Phase 6 vs plan.** The three follow-ups change no runtime behaviour: 6.1 is a README sentence plus a test pinning an already-existing rejection; 6.2 and 6.3 adjust `index.d.ts` declarations to match what `validate.js` and the frozen `core.js` actually pass — `flash` is probed with `'settling'` at [validate.js](../../../../src/variants/validate.js#L126); `renderStaticSVG` forwards `opts.dark` raw at [src/core.js](../../../../src/core.js#L81) while `mountGlyph` normalises it with `opts.dark != null ? !!opts.dark : autoDark()` at [L92](../../../../src/core.js#L92), so the new "mounted glyphs always pass a boolean" wording in the README and JSDoc is accurate. All three stay inside the plan's affected-files list.
- **Undocumented changes:** none.

## Roadmap audit

Every ticked box was spot-checked against the codebase and commit history:

- 1.1 (`6ff185b`) touches only roadmap.md; baseline numbers match plan `## Research`.
- 1.2 (`428235b`) adds only `test/authoring.test.js`, honouring "commit before any `src/` change".
- 1.3 (`618b9f2`) touches only `test/react-variant.test.js`.
- 2.1, 2.2, 3.1, 4.1–4.4: the named files exist with the described content; the `verify:` grep/tsc/test commands were rerun above and pass (4.1 symbol counts, 4.4 heading order and counts, `npm test`, tsc). The `src/`, `demo/` and fixture files these steps produced are unchanged since `62ecfec`.
- 5.1: gate rerun matches (table above).
- 5.2: linked evidence file present with a completion date on the line; target re-driven by me at `ca49ee0` with matching observations.
- 5.3 (`62ecfec`): roadmap-only commit, as recorded.
- 6.1 (`de545c5`) touches `README.md`, `test/authoring.test.js`, roadmap only. Verify rerun: `grep -c "typeof window" README.md` → `1`; `node --test test/authoring.test.js` → `# tests 23`, `# fail 0` (≥ 21). The sentence sits in `### Validating a variant` ([README.md](../../../../README.md#L255-L258)); the new `guardedDerive` case ([test/authoring.test.js](../../../../test/authoring.test.js#L124-L131)) asserts `/Variant "guarded".*"derive".*"window"/`.
- 6.2 (`b0a7cf7`) touches `index.d.ts`, `test/authoring.test.js`, roadmap only. Verify rerun: `grep -c "flash(params: P, state: GlyphState | 'settling')" index.d.ts` → `1`; tsc → `1` error naming `'react'`; `# tests 23` ≥ 22. The spy-`flash` case ([test/authoring.test.js](../../../../test/authoring.test.js#L92-L105)) asserts the recorded state set equals `[...STATES, 'settling']`; my plain-Node probe recorded exactly `idle,working,waiting,done,error,thinking,sending,receiving,sleeping,settling`.
- 6.3 (`f765234`) touches `README.md`, `index.d.ts`, `test/authoring.test.js`, roadmap only. Verify rerun: `grep -c "dark?: boolean" index.d.ts` → `3` (lines 58, 113, 235 — `GlyphOptions`, `VariantPaintEffects`, `PrismiconProps`); `grep -c "^    dark: boolean" index.d.ts` → `0`; `grep -c "effects.dark" README.md` → `1`; `npm test` → `# tests 114`, `# fail 0`; golden diff exit 0; frozen-files diff exit 0. The spy-`paint` case ([test/authoring.test.js](../../../../test/authoring.test.js#L271-L289)) asserts `[undefined]` then `[true]`; my probe additionally saw `dark: false` forwarded as `false`. The step line records its own verify repair (`3` from `1`, which had overlooked the two pre-existing matches); the repaired expectation is the correct one.
- 6.4 (`ca49ee0`) touches roadmap only; `git status --porcelain` empty; `git log origin/feature/custom-variant-authoring -1 --format=%s` → `chore(roadmap): return custom-variant-authoring to review after follow-ups (6.4)`.

No falsely ticked boxes; no missing-work steps needed; no `(manual)` or `(manual, post-ship)` steps. No repairs made.

## Findings

Ordered by severity. None above informational; the three minor findings from the `62ecfec` review are resolved.

1. **Resolved — SSR probe rejects `typeof window` guards (prior Finding 1).** [README.md](../../../../README.md#L255-L258) now states it and gives the reason (an environment-dependent branch makes server and client output disagree); the behaviour is pinned by [test/authoring.test.js](../../../../test/authoring.test.js#L124-L131) under JSDOM and — per my probe — holds in plain Node too, because the probe installs an accessor on `globalThis` even when the name was absent, so `typeof window` invokes the getter.
2. **Resolved — `flash` state type (prior Finding 2).** [index.d.ts](../../../../index.d.ts#L159-L160): `flash(params: P, state: GlyphState | 'settling')` matches `pose` and the probe; an exhaustive `GlyphState` switch is now a compile error (acceptance item 7).
3. **Resolved — `VariantPaintEffects.dark` optionality (prior Finding 3).** [index.d.ts](../../../../index.d.ts#L112-L113): `dark?: boolean` with JSDoc; README `paint` row updated ([README.md](../../../../README.md#L226)); runtime pinned by test.
4. **Informational — README hook table `flash` row still does not mention `'settling'`.** [README.md](../../../../README.md#L227) documents `flash` as called "on each state transition"; only the `pose` row ([L224](../../../../README.md#L224)), the `### Validating a variant` prose and the `index.d.ts` JSDoc say the probe also passes `'settling'`. An author reading the table alone could still be surprised by the probe. One clause on the `flash` row would close it; not blocking.
5. **Informational — test fixture depends on `demo/`** (carried over). [test/fixtures/square-variant.js](../../../../test/fixtures/square-variant.js#L13) re-exports `../../demo/square-variant.js` by plan intent (documented example = example under test); `npm pack` excludes both directories.
6. **Skill conformance — no issues.** modern-javascript-patterns: the new test cases use `const`, spread copies of `square`, and closure spies whose only mutable state is a per-test array/set; source unchanged since the prior review (`const` throughout, pure functions, `Object.freeze` on every returned surface, `finally`-based restoration, independent instances asserted in test). vercel-react-best-practices: unchanged — provider value memoised on registry identity (`rerender-dependencies`), hoisted frozen default context (`rerender-memo-with-default-value`), no new entry point or import-time work, `sideEffects: false` intact (`bundle-*`), no module-level request state (`server-no-shared-module-state`). Security: no user input reaches `innerHTML` beyond the frozen render path; the SSR probe redefines only a fixed allow-list of names and restores descriptors even on throw.

## Follow-ups

- Add a clause to the README hook table `flash` row noting `validateVariant` also passes `'settling'` (Finding 4) — cosmetic; could ride along with `variant-build-tooling`.
- `demo/index.html` still imports `deriveV1`/`describeParams` for the polyhedron-only console helper; a later demo pass could route it through `prismicon.registry.get(id).derive` so the page is fully registry-driven. Cosmetic, not in this feature's scope.
