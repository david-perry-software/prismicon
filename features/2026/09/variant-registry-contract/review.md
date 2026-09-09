# Review: variant-registry-contract

Verdict: approve

Reviewed at `19c28e2` (`feature/variant-registry-contract`, PR #7 draft) against
`origin/main` `7ebe9b5` (confirmed ancestor of `HEAD` via `git merge-base
--is-ancestor`, exit 0). Skills consulted: modern-javascript-patterns,
vercel-react-best-practices (server-no-shared-module-state, bundle-analyzable-paths;
no React source was touched). All commands below were run by the reviewer in this
worktree on 2026-09-08.

Change set (`git diff --name-status origin/main...HEAD`): six additions, zero
modifications — `src/variants/registry.js`, `src/variants/polyhedron.js`,
`src/variants/index.js`, `test/variants.test.js`, plus `plan.md`/`roadmap.md` under
this slug.

## Acceptance checklist results

Tally: 11 pass / 0 fail / 0 deferred.

1. **`npm test` exits 0, 13 baseline + all new tests pass** — PASS. `npm test` →
   exit 0, `# tests 32`, `# pass 32`, `# fail 0`. `node --test test/variants.test.js`
   → `# tests 19`, `# pass 19`, `# fail 0`; 13 + 19 = 32.
2. **`defineVariant` rejects invalid `id`, missing/non-function hook, unknown key,
   non-string `label`/`spec` with `TypeError`; returns frozen descriptor** — PASS.
   [test/variants.test.js](test/variants.test.js#L37-L99) (`defineVariant` suite:
   7 subtests, all `ok`); implementation
   [src/variants/registry.js](src/variants/registry.js#L47-L71) checks unknown keys,
   id pattern, string fields, hooks in that order and returns `Object.freeze({ ...descriptor })`.
3. **`createVariantRegistry` rejects duplicate ids and unregistered `defaultId`;
   `ids` ordered and frozen** — PASS.
   [test/variants.test.js](test/variants.test.js#L106-L127) (`rejects duplicate ids`,
   `rejects an unregistered defaultId`, `ids preserve registration order and are
   frozen`); implementation [src/variants/registry.js](src/variants/registry.js#L90-L105).
4. **`resolve(undefined)`/`resolve(null)` → default; `resolve('unknown')` throws
   `RangeError` naming id + registered ids; non-string key throws `TypeError`** — PASS.
   [test/variants.test.js](test/variants.test.js#L139-L166) asserts `/"nope"/` and
   `/alpha, beta/` in the `RangeError` message and `TypeError` for
   `[42, {}, [], true, Symbol('x')]`; `polyhedron built-in variant` suite asserts
   `resolveVariant()`/`resolveVariant(null)` return the polyhedron descriptor
   ([test/variants.test.js](test/variants.test.js#L170-L183)). Implementation
   [src/variants/registry.js](src/variants/registry.js#L111-L125).
5. **`BUILT_IN_VARIANTS.get('polyhedron').renderStatic` equals `renderStaticSVG`;
   `.derive` deep-equals `FROZEN` for the three seeds** — PASS.
   [test/variants.test.js](test/variants.test.js#L185-L201): `derive` deep-equals both
   `deriveV1(seed)` and the copied fixture; `renderStatic` string-equals
   `renderStaticSVG` across 4 option sets × 3 seeds. Additionally `registered.derive
   === deriveV1` and `registered.renderStatic === renderStaticSVG` by identity
   ([test/variants.test.js](test/variants.test.js#L176-L177)). The copied `FROZEN`
   literal matches [test/derivation-freeze.test.js](test/derivation-freeze.test.js)
   byte-for-byte (compared by eye against `grep -A4 'const FROZEN'`; both files pass).
6. **`test/derivation-freeze.test.js` unmodified and passing** — PASS. Included in the
   `git diff --quiet origin/main -- …` run below (exit 0); `npm test` exit 0.
7. **Public surface unchanged** — PASS. `git diff --quiet origin/main -- src/index.js
   src/core.js src/react.js index.d.ts README.md demo/index.html package.json
   package-lock.json test/derivation-freeze.test.js test/prismicon.test.js` → exit 0.
   Export-list guard [test/variants.test.js](test/variants.test.js#L203-L222) asserts
   exactly the 11 names and no key matching `/variant/i`; passes.
8. **`registry.js` imports nothing from `core.js`** — PASS. `grep -c "core.js"
   src/variants/registry.js` → `0`. The file has no `import` statements at all.
9. **No mutable module-level registry state, no import-time registration side
   effects, `sideEffects: false` untouched** — PASS. Code review:
   [src/variants/registry.js](src/variants/registry.js) holds only `const`
   pattern/name lists; the `Map` in `createVariantRegistry` is closure-local and the
   returned object is frozen with no mutation API.
   [src/variants/index.js](src/variants/index.js#L9) builds `BUILT_IN_VARIANTS` from a
   static list — a pure expression, not a `register()` call. `grep '"sideEffects":
   false' package.json` matches; `package.json` has no diff from `origin/main`.
10. **`npm pack --dry-run` lists the three variant modules** — PASS. Output includes
    `src/variants/index.js` (735B), `src/variants/polyhedron.js` (522B),
    `src/variants/registry.js` (4.9kB).
11. **Lint gate** — PASS. AGENTS.md declares `Lint: none`, `Typecheck: none`; the
    complete gate is `npm test`. Fresh run: 32 pass / 0 fail vs recorded baseline
    13 pass / 0 fail on `origin/main`. No new or undocumented findings; no scoped-gate
    components were required.

No step in the roadmap names a `local:`/`dev-stack`/`preview:` target; the plan
states the feature has no user-visible effect and the diff confirms no rendering path
changed, so no browser re-drive or screenshot applies.

## Plan vs implementation

The implementation matches `## Approach` closely; no undocumented changes.

- `registry.js`: `VARIANT_ID_PATTERN`, `defineVariant`, `createVariantRegistry` with
  `ids`/`defaultId`/`has`/`get`/`resolve`, `TypeError` for shape errors, `RangeError`
  for unknown ids, module header documenting the reserved `variant` key and the
  fallback rule — all as planned. Error text `Unknown prismicon variant "<id>";
  registered: <ids>` matches the plan literally.
- `polyhedron.js` binds the five core exports exactly as specified.
- `index.js` exports `DEFAULT_VARIANT_ID`, `BUILT_IN_VARIANTS`, `resolveVariant(key,
  registry = BUILT_IN_VARIANTS)` and re-exports the three registry names as planned.
- Tests cover every bullet in the plan's test section plus extras not required by the
  plan (non-object descriptors, `Symbol` key, identity of `derive`/`renderStatic`).
- Decisions honored: registry stays internal (D1), no `variant` option wired (D2),
  unknown id throws (D3), default id `'polyhedron'` (D4), descriptor carries exactly
  id/label/spec + four hooks with unknown keys rejected (D5).
- Deviation, benign: `createVariantRegistry(descriptors, { defaultId } = {})` defaults
  the options bag, so `createVariantRegistry([a])` throws the documented
  `TypeError` about the default rather than a destructuring `TypeError`. Tested at
  [test/variants.test.js](test/variants.test.js#L118).

## Roadmap audit

All 14 ticked steps spot-checked against the codebase and the commands above; no
falsely ticked boxes, no missing steps, no repairs made.

- 1.1 / 1.3: export set `VARIANT_ID_PATTERN,createVariantRegistry,defineVariant`,
  `typeof createVariantRegistry === 'function'`, grep count `0`. Note: 1.1's `verify:`
  literal (`VARIANT_ID_PATTERN,defineVariant`) describes the module before 1.3 added
  the third export; the step's own work is present and was correctly verified at its
  commit (`8d671c9`), so the tick stands.
- 1.2 / 1.4 / 2.3 / 2.4: `node --test test/variants.test.js` exit 0, 19/19.
- 2.1: prints `polyhedron v1 true`. 2.2: prints `polyhedron polyhedron`.
- 3.1: diff-quiet exit 0; `git status --porcelain` clean at `19c28e2`.
- 3.2: commit `3bd17b5` body records `32 tests, 32 pass, 0 fail` against baseline
  `13 pass / 0 fail` — reproduced.
- 3.3: pack listing and `sideEffects` grep reproduced.
- 3.4: `origin/main` (`7ebe9b5`) is an ancestor of `HEAD`; header is
  `status: in-review`, `next-step: ""`.

No `(manual)` or `(manual, post-ship)` steps exist.

## Findings

No findings above minor severity.

- **Minor** — Descriptor identity is not preserved through the registry.
  `createVariantRegistry` re-runs `defineVariant`, which always returns a fresh frozen
  copy ([src/variants/registry.js](src/variants/registry.js#L70) and
  [L96](src/variants/registry.js#L96)), so `BUILT_IN_VARIANTS.get('polyhedron') !==
  polyhedron` even though they are `deepEqual`. The test acknowledges this by using
  `deepEqual` ([test/variants.test.js](test/variants.test.js#L175)). Harmless today,
  but a wave-2/3 consumer that compares descriptors by `===` (e.g. React `useEffect`
  dependencies keyed on a descriptor) would see a spurious change. Consider having
  `defineVariant` return an already-validated frozen descriptor unchanged (e.g. a
  module-private `WeakSet` of validated descriptors), or documenting that consumers
  must compare by `id`.
- **Nit** — Parity test asserts identity for `derive` and `renderStatic` only
  ([test/variants.test.js](test/variants.test.js#L176-L177)); `describe` and `mount`
  are bound identically in [src/variants/polyhedron.js](src/variants/polyhedron.js#L19-L21)
  but not asserted `===` `describeParams`/`mountGlyph`. Two one-line assertions would
  close the gap.
- **Nit** — `src/variants/*.js` ships in the npm tarball (by design, `files: ["src"]`)
  with no `index.d.ts` declarations. Intentional while internal; wave 2 must add
  typings when it exposes any of this surface.

Security: no user input reaches anything but error-message interpolation of a caller-
supplied string; no I/O, no eval, no dependencies added. Nothing OWASP-relevant.

## Follow-ups

- Preserve descriptor identity through `defineVariant`/`createVariantRegistry` (or
  document id-based comparison) before `react-variant-selection` keys React effects on
  descriptors.
- Add `describe`/`mount` identity assertions to the polyhedron parity test.
- Wave-2 (`variant-renderer-integration`) planner: honor the import-cycle hand-off note
  in plan.md `## Approach` — `polyhedron.js` imports `core.js`, so the dispatcher must
  live outside `core.js`.
