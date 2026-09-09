# Review: variant-renderer-integration

Verdict: approve

Re-review at `a222987` (`feature/variant-renderer-integration`, PR #8 draft) against
`origin/main` `ec81fac` (ancestor of `HEAD` via `git merge-base --is-ancestor`, exit 0;
this worktree owns the branch; `git status --porcelain` empty before the review
commit). Supersedes the request-changes review at `ff1168b` (2026-09-08). Skills
consulted: modern-javascript-patterns (pure functions, immutable data, explicit typed
errors at the boundary), vercel-react-best-practices
(`server-no-shared-module-state`, `bundle-analyzable-paths`, `js-early-exit`;
`src/react.js` untouched). All commands below were run by the reviewer in this worktree
on 2026-09-08. Concurrent delivery: `gh pr list --state open` returns only PR #8.

Change set since the previous review (`git diff --stat ff1168b..HEAD`): `src/core.js`
(−30/+2), `index.d.ts` (−2), `test/variants.test.js` (+24), `roadmap.md`. Full change
set against `origin/main`: 18 files, source `src/core.js`, `src/index.js`,
`src/variants/{index,polyhedron,registry}.js`, `index.d.ts`, `README.md`,
`demo/index.html`; tests/tooling `test/helpers/golden.js`,
`test/fixtures/{golden-v1.json,square-variant.js}`, `test/golden-v1.test.js`,
`test/renderer-dispatch.test.js`, `test/variants.test.js`,
`scripts/generate-golden.mjs`; evidence `evidence/step-5-2-demo-variant-select.png`.

## Resolution of previous findings

- **Major (default renderer bound to a shim registry) — resolved.**
  [src/core.js](../../../../src/core.js#L21) now `import { BUILT_IN_VARIANTS } from
  './variants/index.js'`; the inline `polyhedron` literal, the fake `resolve(key)`
  object, and the five dead hook imports are gone (`grep -c "variants/index.js"
  src/core.js` → `1`; `grep -cE "resolve\(key\)|const polyhedron = \{" src/core.js` →
  `0`). The public renderer and `listVariants()` now read the same registry object.
  Contract parity verified through `src/index.js`: `renderStaticSVG('x', { variant: 42
  })` → `TypeError` (was `RangeError`); `{ variant: 'nope' }` → `RangeError`, message
  names `polyhedron`. New suite `public renderer error contract`
  ([test/variants.test.js](../../../../test/variants.test.js#L225-L253)) pins both
  entry points, including `mountGlyph` throwing before `el.classList.add` is reached
  (the fake host throws if mutated). Import graph is cycle-free:
  `core.js → variants/index.js → { registry.js, polyhedron.js → registry.js }`.
- **Minor (`PrismiconProps.variant` out of scope) — resolved.** Removed from
  [index.d.ts](../../../../index.d.ts#L64-L73); `src/react.js` remains untouched.
- **Minor (roadmap 4.2 verify literal) — resolved** in the previous review; a second
  literal (`grep -c "variant" ≥ 4`) became unsatisfiable once the React prop was
  removed (case-sensitive count `3`) and is corrected below to the case-insensitive
  count (`6`). No code change.
- Nits (explicit `renderStatic`/`mount` rejection assertions; `animationFrames` naming
  in the dispatch helper) and the pre-existing engine observation remain as
  follow-ups; none is above minor.

## Acceptance checklist results

Tally: 16 pass / 0 fail / 0 deferred.

1. **`npm test` exits 0, `# fail 0`, ≥ 32 baseline + new** — PASS. `npm ci && npm
   test` → `# tests 50`, `# pass 50`, `# fail 0` (1 derivation-freeze, 1 golden, 12
   prismicon, 12 renderer-dispatch, 24 variants).
2. **Golden fixture captured from unmodified `src/`; passes against final code** —
   PASS. Fixture commit `2fc35d1` touches no `src/` file and precedes every `src/`
   commit (`git log --oneline origin/main..HEAD -- src test/fixtures`). On `HEAD`,
   `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures/golden-v1.json`
   → exit 0 (byte-identical after the shim removal). Golden test `ok`.
3. **`test/prismicon.test.js`, `test/derivation-freeze.test.js`, `src/react.js`,
   `package.json` unchanged** — PASS. `git diff --quiet origin/main -- …` → exit 0.
4. **`defineVariant` requires the seven hooks and rejects `renderStatic`/`mount` as
   unknown keys** — PASS. [src/variants/registry.js](../../../../src/variants/registry.js#L43-L45);
   [test/variants.test.js](../../../../test/variants.test.js#L64-L86) (`HOOK_NAMES`
   loop for missing/non-function, unknown-key rejection).
5. **`renderStaticSVG(seed, { variant: 'polyhedron' }) === renderStaticSVG(seed)`
   for `PARITY_OPTS` × frozen seeds** — PASS. [test/variants.test.js](../../../../test/variants.test.js#L215-L222).
6. **Square fixture: static paint + ring + aria-label; `user` no ring/suffix; mounted
   `working` changes geometry; `setState` updates ring/aria; reduced motion → 0 rAF,
   static pose, ring updates; `destroy()` empties host** — PASS.
   [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js) tests
   1–6 `ok`. Reviewer also confirmed a custom registry renders `<rect>` for `square`
   and the default renderer rejects `square` with `RangeError` (inline node probe).
7. **Unknown id → `RangeError` naming id + registered ids from both entry points; host
   untouched; non-string → `TypeError`; default renderer rejects `'square'`** — PASS.
   Custom registry: [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L118-L148).
   Public default renderer: [test/variants.test.js](../../../../test/variants.test.js#L225-L246)
   (`TypeError` for `42, {}, [], true, Symbol` from both `renderStaticSVG` and
   `mountGlyph`; `RangeError` naming `"nope"` and `polyhedron`).
8. **`handle.variant` equals the resolved id** — PASS.
   [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L150-L160);
   browser: `window.handle.variant === 'polyhedron'` after remount.
9. **Two `createRenderer` renderers share one engine** — PASS.
   [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L162-L183)
   asserts exactly one pending frame after two mounts and both glyphs advance on it.
10. **`src/index.js` exports exactly 11 + `DEFAULT_VARIANT_ID` + `listVariants`;
    `listVariants()` frozen and equal to the polyhedron record** — PASS.
    [test/variants.test.js](../../../../test/variants.test.js#L255-L278).
11. **No `src/variants/*` imports `core.js`** — PASS. `grep -c core.js` → `0`, `0`,
    `0`.
12. **`index.d.ts` declares `GlyphOptions.variant?`, `GlyphHandle.variant`,
    `VariantInfo`, `DEFAULT_VARIANT_ID`, `listVariants`; `tsc --strict` clean except the
    pre-existing `react` import** — PASS. `tsc … | grep -cE "error TS"` → `1`, and that
    line names `'react'` (TS7016 on L66, identical in kind to `origin/main`'s single
    diagnostic). `grep -ci variant index.d.ts` → `6`.
13. **README `## Variants` between `## Vanilla API` and `## Derivation spec v1`** —
    PASS. Lines 88 / 107 / 128; documents per-icon `variant`, `listVariants()`,
    `DEFAULT_VARIANT_ID`, `handle.variant`, throw-on-unknown, React deferral.
14. **Demo `<select>` from `listVariants()` remounts hero; `local:3128` loads without
    console errors, lists `polyhedron`, remount keeps aria-label state** — PASS.
    `grep -c listVariants demo/index.html` → `2`; `grep -c 'id="variant"'` → `1`.
    Reviewer re-drove `http://127.0.0.1:3128/demo/index.html` against the fixed
    `src/core.js` (`python3 -m http.server 3128 --bind 127.0.0.1`): console contains
    only `variant: polyhedron anatomy: …` lines, no errors or page errors; `#variant`
    options → `[{ polyhedron, "Polyhedron", selected }]`; hero aria-label ends
    `, working`; after clicking `done` → `, done`; after `change` on `#variant` the
    `<svg>` node is replaced (`outerHTML` differs) and aria-label still ends `, done`;
    `window.handle.variant` → `polyhedron`. Screenshot from the previous run remains
    valid (demo markup and default output are unchanged — golden identical) at
    [evidence/step-5-2-demo-variant-select.png](evidence/step-5-2-demo-variant-select.png).
    Server stopped afterwards (`curl` → connection refused).
15. **`npm pack --dry-run` lists the six `src/` files and nothing from `test/` or
    `scripts/`** — PASS. `src/core.js` (10.8 kB), `src/index.js`, `src/react.js`,
    `src/variants/index.js`, `src/variants/polyhedron.js`, `src/variants/registry.js`;
    no `test/` or `scripts/` entries.
16. **Lint gate** — PASS. AGENTS.md: `Lint: none`, `Typecheck: none`; complete gate =
    `npm test`: baseline 32 pass / 0 fail → 50 pass / 0 fail.

## Plan vs implementation

Now matches `## Approach` in full: module layout and cycle-free import graph, descriptor
contract v2 (seven hooks, unknown keys rejected, header/typedef documentation of `ctx`,
`effects`, pose immutability, `ctx.rest` settled signal), variant-agnostic engine `step`
(animate → transitions → flash → single DOM write), `mountGlyph` resolving `variant`
before any DOM mutation, `handle.variant`, `createRenderer` exported from `core.js` but
not from `index.js`, public surface of exactly 13 names, `index.d.ts` additions limited
to the planned five, README placement, demo selector. Decisions 1–5 honoured
(discovery-only public surface, narrow hooks, test-only `square`, `handle.variant`
without `data-variant`, basic demo). No undocumented deviations remain.

Benign notes: `handle.variant` is a getter (read-only, matches `readonly variant:
string`); descriptor identity through `createVariantRegistry` is still a copy
(`BUILT_IN_VARIANTS.get('polyhedron') !== polyhedron`) — wave-1 follow-up, unchanged.

## Roadmap audit

All 15 ticked steps spot-checked; one verify literal repaired; no falsely ticked boxes.

- 1.1 / 1.2: fixture predates `src/` changes; regenerates identically; 30/5 entries.
- 2.1 / 2.2 / 2.3: engine variant-agnostic; polyhedron relocated with zero `core.js`
  references; `HOOK_NAMES` v2; `polyhedron = defineVariant(...)`; `listVariants`.
- 3.1: **re-ticked correctly** — `createRenderer` exists, default renderer is now over
  the real `BUILT_IN_VARIANTS`, `RangeError true` verify reproduced.
- 3.2: fixture + 12 dispatch tests green.
- 3.3 (added 2026-09-08): all five verify commands reproduced (`# fail 0`; `1`; `0`;
  `TypeError`; golden diff-quiet exit 0). Tick stands.
- 4.1: 13-name guard + frozen `listVariants()` assertion green.
- 4.2: `error TS` count `1` naming `'react'`. **Verify text repaired**: `grep -c
  "variant" ≥ 4` → `grep -ci "variant" ≥ 4` (case-sensitive count is `3` after the
  out-of-scope React prop was removed; case-insensitive `6`). Tick stands.
- 4.3 / 5.1 / 5.2: README positions, demo grep counts, and browser assertions
  reproduced.
- 6.1: gate reproduced in full (`npm ci && npm test` 50/50; pack listing; baseline
  diff-quiet; cycle grep). 6.2: header `status: in-review`, `next-step: ""`; clean tree;
  roadmap commit at `origin/…` head.

No `(manual)` or `(manual, post-ship)` steps exist.

## Findings

No findings above minor severity.

- **Nit** — `test/variants.test.js` proves `renderStatic`/`mount` are rejected only
  through the generic unknown-key test (`motion`). Two assertions naming them would pin
  the v1→v2 break explicitly.
- **Nit** — [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L41-L43)
  `animationFrames` returns the pending-queue length, unlike the same-named total
  counter in `test/prismicon.test.js`; correct for its current use, misleading name.
- **Observation (pre-existing)** — engine `running` stays `true` after the last
  `destroy()` until the next rAF tick; benign in browsers, forces cache-busting imports
  in tests. Not in scope.

Security: caller-supplied `seed` and `variant` reach only the aria-label (unchanged
from `origin/main`) and error-message interpolation; demo `<select>` values come from
`listVariants()`. No new dependencies, I/O, or eval.

## Follow-ups

- Carry-over from wave 1: preserve descriptor identity through `createVariantRegistry`
  (or document id-based comparison) before `react-variant-selection` keys effects on
  descriptors.
- Optional: explicit `renderStatic`/`mount` rejection assertions; rename the dispatch
  helper's `animationFrames` to `pendingFrames`.
- Engine owner: consider clearing `running` in `destroy()` when `instances` becomes
  empty so tests no longer need per-test module instances.
