# Review: variant-renderer-integration

Verdict: **request-changes**

Re-review at `a222987` (`feature/variant-renderer-integration`, PR #8 draft) against
`origin/main` `ec81fac`. Working tree clean before this review commit. Supersedes the
approve review written on 2026-09-08.

## Acceptance checklist

Tally: deferred pending fixes.

All previously passing assertions from the 2026-09-08 review remain valid, but two
blocking issues are introduced below. The feature cannot ship until both are resolved
and the checklist is re-run.

## Findings

### Major — `mountGlyph()` mutates the document before validating `variant`

[src/core.js](../../../../src/core.js#L108-L111)

```js
function mountGlyph(el, seed, opts = {}) {
  const eng = getEngine();
  const variant = registry.resolve(opts.variant);
```

`getEngine()` is invoked before `registry.resolve(opts.variant)`. On first call in a
browser, `getEngine()` injects `<style id="prismicon-style">` into `document.head`
([src/core.js](../../../../src/core.js#L198-L207)). A caller passing an invalid
`variant` option — e.g. `mountGlyph(el, 'x', { variant: 42 })` or
`{ variant: 'nope' }` — therefore leaves a side effect in the global DOM before the
expected `TypeError`/`RangeError` is thrown. This violates the error contract that
mounting with bad options must not touch the host element, and also pollutes
`document.head`.

**Fix:** resolve `opts.variant` before calling `getEngine()`. Any code that needs the
engine's reduced-motion state to pick the initial pose can defer that lookup until
after validation (the invalid-input path does not need the engine). The `renderStaticSVG`
path already validates first and is unaffected.

**Test to add:** in `test/renderer-dispatch.test.js` (or `test/variants.test.js`),
assert that after an invalid `variant` is rejected by `mountGlyph`:

- `document.getElementById('prismicon-style')` is `null`, and
- the host element's `innerHTML === ''` and it has no `prismicon` class.

Because `getEngine()` is a singleton, tests may currently share a single engine instance
across the process; use per-test module cache-busting or test against a fresh JSDOM
document so the style element is not left over from a previous test. The assertion must
be strong enough to fail with the current code.

### Major — shared engine reads `params.hue`, violating opaque params contract

[src/core.js](../../../../src/core.js#L165-L168)

```js
} else if (name === 'sending' || name === 'receiving') {
  inst.state = name; inst.transientT = 0; inst.flashT = 0; inst.shake = false;
  if (name === 'receiving') { inst.flash = p.hue; inst.lightenFlash = true; }
```

`setState('receiving')` reaches into `p.hue` to configure the flash effect. The variant
contract documented in [src/variants/registry.js](../../../../src/variants/registry.js)
says `params` is returned by `prepare(params, { size })` and is otherwise opaque to the
shared engine. A variant that does not derive a `hue` field (e.g. the test-only `square`
fixture, or any future non-polyhedron variant) will set `inst.flash = undefined`, which
silently disables the `receiving` flash instead of letting the variant decide how to
paint that transient state.

**Fix:** the engine must ask the variant descriptor for the flash color/hue for transient
states. Options, in order of preference:

1. Add a narrow hook `flash(params, state) → { hue?, lighten?, shake? } | null` to the
descriptor contract and have `setState` call `variant.flash(p, name)` for `sending`,
`receiving`, `done`, and `error`. The polyhedron implementation returns the hue values
and shake flag the engine currently hard-codes; other variants can return their own
values or `null` to opt out.
2. Have `pose(params, state)` or a new `effect(params, state)` hook return a richer
object that includes transient flash metadata alongside the pose.

Either approach is acceptable as long as `params.hue` is no longer read by `src/core.js`.
Update `src/variants/registry.js` documentation, `HOOK_NAMES`, `defineVariant`, the
`VariantDescriptor` typedef, and the polyhedron descriptor accordingly.

**Tests to add:**

- `test/renderer-dispatch.test.js`: with the `square` variant, `setState('receiving')`
  completes its transient animation without reading `params.hue` and without throwing.
- A static analysis guard: `grep -n "p\.hue\|params\.hue" src/core.js` must print
  nothing (or add a project-level check in the gate).

## Plan vs implementation notes

The two issues above are regressions/oversights in the otherwise correct v2 contract
refactor. The remainder of the implementation matches the plan: descriptor contract v2,
cycle-free imports, `createRenderer` over `BUILT_IN_VARIANTS`, `handle.variant`, public
surface of 13 names, README and demo updates, byte-identical golden output, and
`npm test` 50/0. This review only blocks on the two findings; all other acceptance
checklist items will be re-verified after they are fixed.

## Follow-ups

- Re-run the full gate (`npm ci && npm test`, `npm pack --dry-run`, golden regeneration
  diff-quiet, `grep -c "core.js" src/variants/*.js`, and the browser demo assertions)
  once both findings are fixed.
- Consider adding a regression test that enumerates all `BUILT_IN_VARIANTS` ids and
asserts `mountGlyph` throws before mutating the host for each invalid input shape.
