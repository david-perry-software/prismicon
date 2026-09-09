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
# Review: variant-renderer-integration

Verdict: approve

Reviewed `6228064` on `feature/variant-renderer-integration` against `origin/main`
(`ec81fac`). `agento.mjs resolve feature variant-renderer-integration` returned
`status: ok`; the worktree owns the roadmap branch, `origin/main` is an ancestor,
and the worktree was clean before this review artifact update.

## Acceptance checklist results

All 16 plan acceptance items pass:

- Pass — `npm ci && npm test`: 52 tests, 52 pass, 0 fail.
- Pass — `node scripts/generate-golden.mjs` wrote 30 static and 5 mounted entries;
  `git diff --quiet -- test/fixtures/golden-v1.json` exited 0. The fixture commit
  `2fc35d1` precedes every later `src/` change in `git log --oneline --reverse
  origin/main..HEAD -- src test/fixtures`.
- Pass — `git diff --quiet origin/main -- test/prismicon.test.js
  test/derivation-freeze.test.js src/react.js package.json` exited 0.
- Pass — `test/variants.test.js` verifies all seven v2 hooks are required and
  rejects the removed `renderStatic` and `mount` keys; the full suite passed.
- Pass — the polyhedron parity tests cover every `PARITY_OPTS` entry and the frozen
  seeds; the full suite passed.
- Pass — `node --test test/renderer-dispatch.test.js` passed all 14 tests covering
  square rendering, state rings, reduced motion, animation, and cleanup.
- Pass — the same 14-test suite verifies unknown ids and non-string keys throw before
  host/document mutation, and the default renderer rejects `square`.
- Pass — the dispatch suite verifies `handle.variant` for both polyhedron and square.
- Pass — the dispatch suite verifies two renderers share one rAF chain.
- Pass — the public-surface suite verifies exactly 13 exports and frozen discovery
  records from `listVariants()`.
- Pass — `grep -F 'core.js' src/variants/{registry,polyhedron,index}.js` found no
  imports.
- Pass — the roadmap TypeScript command reported only the documented pre-existing
  `TS7016` diagnostic for the unresolved React declaration.
- Pass — `README.md` contains the `## Variants` section between the vanilla API and
  frozen derivation sections with the requested API and error behavior.
- Pass — browser verification at `http://127.0.0.1:3128/demo/index.html`: no page
  load errors, one selected `Polyhedron` option, hero `working` label, `done` label
  after clicking the state button, and a new SVG node after re-selecting the variant
  while preserving the `done` label. The committed screenshot is
  [evidence/step-5-2-demo-variant-select.png](evidence/step-5-2-demo-variant-select.png).
- Pass — `npm pack --dry-run` listed all six required `src` files and no `test/` or
  `scripts/` paths.
- Pass — AGENTS.md declares no lint or typecheck command; the complete `npm test`
  gate passed against the recorded 32-test baseline, with no lint findings.

## Plan vs implementation

The implementation matches the planned v2 architecture: the shared engine owns
accessibility, rings, reduced motion, lifecycle scheduling, and DOM writes while
variant descriptors own derivation, geometry, poses, animation, painting, and flash
effects. The two 2026-09-09 review fixes are present and verified:

- [src/core.js](../../../../src/core.js) resolves the variant before `getEngine()` in
  `mountGlyph`; the regression test confirms invalid mounts leave the host empty,
  without the `prismicon` class, and without the injected style element.
- [src/variants/registry.js](../../../../src/variants/registry.js), the polyhedron
  descriptor, and the square fixture define and use the narrow `flash` hook. The
  square receiving-state test passes, and a static search found no `p.hue` or
  `params.hue` read in `src/core.js`.

No undocumented implementation deviations were found. Protected v1 tests, React
integration, and package metadata remain unchanged as planned.

## Roadmap audit

All roadmap steps 1.1 through 7.2 are ticked and have matching evidence. The
roadmap header is `status: in-review`, `next-step: ""`, and `last-updated:
2026-09-09`. The browser evidence file exists, no manual step is falsely ticked,
and no missing-work step or roadmap repair is required.

## Findings

None. The two prior major findings are fixed by commits `dd19c2b` and `f4c0c2d`
and are covered by focused regression tests.

## Follow-ups

None.
