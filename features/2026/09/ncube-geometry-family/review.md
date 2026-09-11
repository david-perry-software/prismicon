# Review: ncube-geometry-family

Verdict: approve

Reviewed at `de0249e` (branch `feature/ncube-geometry-family`, draft PR #10) against
`origin/main` `5a2cd5a` on 2026-09-10. `origin/main` is an ancestor of `HEAD`
(`git merge-base --is-ancestor` → 0), the worktree owns the branch, and
`agento.mjs resolve feature ncube-geometry-family` returned `status: ok`.

Skills consulted: modern-javascript-patterns (ESM layout, `const`, frozen data,
pure hooks in `src/variants/ncube.js` / `seed.js`, the demo module). vercel-react-best-practices
not applied: `src/react.js` is unchanged (verified by diff below).

## Acceptance checklist results

Every command below was run by the Reviewer in this worktree; exit codes are quoted.

1. **`npm test` ≥ 60 + new tests, `# fail 0`; v1 golden byte-identical** — **pass.**
   `npm ci` rc=0; `npm test` rc=0 → `# tests 86`, `# suites 6`, `# pass 86`, `# fail 0`
   (26 new: 21 in `test/ncube.test.js`, 3 in `test/ncube-derivation-freeze.test.js`,
   2 in `test/golden-ncube.test.js`). `node scripts/generate-golden.mjs` rc=0 then
   `git diff --quiet -- test/fixtures/golden-v1.json` rc=0 and
   `git diff --quiet -- test/fixtures` rc=0. Baseline reproduced independently in a
   throwaway detached worktree at `origin/main`: `# tests 60`, `# pass 60`, `# fail 0`
   (matches plan.md `## Research`); 60 → 86 with no regressions.
2. **`seed.js` exports `cyrb53`/`mulberry32`; polyhedron imports, no local copy** — **pass.**
   `grep -cE "^function (cyrb53|mulberry32)" src/variants/polyhedron.js` → `0`;
   `grep -c "from './seed.js'" src/variants/polyhedron.js` → `1`; bodies in
   [src/variants/seed.js](../../../../src/variants/seed.js) match the removed lines in
   the `polyhedron.js` diff verbatim (golden v1 unchanged confirms it).
3. **`listVariants()` ids and default** — **pass.**
   `node -e "import('./src/index.js')…"` → `13 polyhedron,ncube,ncube-3,ncube-4,ncube-5,ncube-6`;
   `DEFAULT_VARIANT_ID === 'polyhedron'`; asserted in `test/ncube.test.js` ("registry:
   built-ins are polyhedron (default) followed by the n-cube family in order") and the
   Reviewer's own check script.
4. **Closed-form geometry counts for d ∈ [3, 6]** — **pass.** Reviewer script:
   `d=3: V=8 E=12 F=6`, `d=4: 16/32/24`, `d=5: 32/80/80`, `d=6: 64/192/240`, all equal to
   $2^d$, $d\,2^{d-1}$, $\binom{d}{2}2^{d-2}$; additionally every face's four sides are
   edges of the graph. Also asserted by `test/ncube.test.js` geometry cases.
5. **`ncube-v1` draw order; freeze test; per-dimension override** — **pass.** The
   Reviewer reimplemented the draw order from plan.md prose (dimension → finish →
   `MAX-3` thetas → ax, ay, az → palette hues) and `deepEqual`-compared it with
   `deriveNcube` for 7 seeds (incl. `' Maya '`): identical. `deriveNcube(seed, d)` equals
   `deriveNcube(seed)` except `dimension` for every d. `node --test test/ncube-derivation-freeze.test.js`
   → `# fail 0`; mutating one `hue` in the fixture → `# fail 1`; fixture restored
   (`git diff --quiet` rc=0).
6. **Static SVG within `[0, 100]`, aria label names `<d>-cube`, static == mounted at
   rest and under reduced motion** — **pass.** Reviewer script checked 15,568 path
   coordinates across all 5 ids × 5 seeds, all within `[0, 100]`, and every aria label
   contains `<d>-cube`. `test/ncube.test.js` "render: static markup equals the mounted
   markup at rest" and "render: reduced motion mount queues no frames…" pass;
   `test/golden-ncube.test.js` pins `ncube` and `ncube-4` static + mounted frames.
7. **`animate` contract; `setState` through all `STATES`; no repaint when static** —
   **pass.** `test/ncube.test.js` "hooks: animate returns its input outside settling and
   ctx.rest inside it", "render: working state never repaints a static n-cube across
   frames", "render: setState through every STATES entry never throws and settles back
   to rest" all `ok` in the 86-test run. Source: [src/variants/ncube.js](../../../../src/variants/ncube.js#L167-L169).
8. **Evidence table and `NCUBE_MAX_DIMENSION` = largest d meeting all three criteria;
   README documents it** — **pass.** `node scripts/measure-ncube.mjs` rc=0 re-run by the
   Reviewer; counts, max-bytes, median-edge and pass columns are identical to
   [evidence/ncube-bounds.txt](evidence/ncube-bounds.txt) (only wall-clock ms differ);
   final line `recommended NCUBE_MAX_DIMENSION=6`. d=6 passes for all finishes
   (25,890 B ≤ 32,768; edge 7.29 ≥ 2.5; ≤ 0.28 ms); d=7 fails on bytes for shaded and
   two-tone (72,115 B). `NCUBE_MAX_DIMENSION = 6` in `ncube.js`; `ncubeVariants.length`
   = 5. README `### N-cube family` carries the criteria and the table (see Finding 1
   about the timing column).
9. **`index.d.ts` types and tsc check** — **pass.** `grep -c BuiltInVariantId index.d.ts`
   → `4`; `NcubeParams` declared; `GlyphOptions.variant` and `PrismiconProps.variant`
   are `BuiltInVariantId | (string & {})`; `GlyphHandle.params` is
   `GlyphParams | NcubeParams`. `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts`
   → exactly 1 `error TS`: `index.d.ts(95,52): error TS7016 … module 'react'`
   (pre-existing).
10. **README `## Variants` content and section order** — **pass.**
    `grep -n "^## " README.md` → `## React API` (71), `## Vanilla API` (89), `## Variants`
    (108), `## Derivation spec v1 (frozen)` (197). The section lists the six ids, `ncube`
    vs `ncube-<d>`, the frozen draw order, the support table, `RangeError` above 6, and
    defers motion to `ncube-motion-system`.
11. **Demo at `local:3173`** — **pass.** Reviewer served `python3 -m http.server 3173 --directory .`
    (port confirmed free first), opened `http://localhost:3173/demo/index.html`: hero
    `<select>` options = `polyhedron, ncube, ncube-3, ncube-4, ncube-5, ncube-6`;
    selecting `ncube-5` remounted the hero as `demo-agent: 5-cube (penteract), two-tone, working`;
    Dimensions row = 4 `<svg>` (3-cube…6-cube); seed `build-bot-7` re-rendered all four
    (still exactly 4 `<svg>`), seed `mailer` produced wireframes with visibly nested
    cells. Evidence: [review-demo-dimensions.png](evidence/review-demo-dimensions.png),
    [review-demo-dimensions-wireframe.png](evidence/review-demo-dimensions-wireframe.png).
    Server stopped (`ss -ltn | grep -c ':3173 '` → 0).
12. **`npm pack --dry-run` file list; thirteen public names** — **pass.** Pack lists
    `index.d.ts`, `src/core.js`, `src/index.js`, `src/react.js`, `src/variants/{index,ncube,polyhedron,registry,seed}.js`
    and nothing under `test/` or `scripts/`. `Object.keys(import('./src/index.js')).length`
    → `13`; `test/variants.test.js` "public surface" passes.
13. **Untouched files** — **pass.**
    `git diff --quiet origin/main -- src/core.js src/react.js src/index.js package.json test/fixtures/golden-v1.json`
    → rc=0.

## Plan vs implementation

- Module layout, exports, descriptor ids/labels, draw order, projection chain
  (`theta` plane rotation per axis k ≥ 3 → perspective from axis k with fixed
  `VIEW_DISTANCE = 3` → uniform fit to 26 units → ZYX `rot3` → `F = 150` → `toFixed(1)`),
  finishes, effects handling, `prepare` wireframe downgrade below size 28, `pose`/
  `animate`/`flash` semantics all match plan.md `## Approach`.
- `NCUBE_NAMES` covers 3–10 and `STROKE_BY_DIMENSION` covers 3–8 although only 3–6
  are registered; the extra entries serve `scripts/measure-ncube.mjs`. Harmless,
  documented by the plan's "as far as the bound needs".
- The measurement script extends `theta` with an extra deterministic PRNG stream for
  d > 6 (`cyrb53(seed + '#measure')`), which is outside `ncube-v1` — acceptable since
  it only affects unpublished measurement of unsupported dimensions.
- No undocumented changes: the diff touches exactly the files listed under
  `## Approach › Affected files` plus the delivery artifacts.

## Roadmap audit

All 15 boxes spot-checked against code and git history; no false ticks, no repairs.

- 1.1 baseline: reproduced (60/60/0 at `origin/main`).
- 1.2: greps above; commit `0855828` is a pure move.
- 2.1: commit `28fa0b6` contains only `test/ncube.test.js` + roadmap; `git ls-tree 28fa0b6 src/variants/`
  has no `ncube.js` (test committed before the module, as required).
- 2.2–2.4: covered by the passing suite and the registry check above.
- 3.1–3.2: measurement re-run reproduces the evidence and `recommended NCUBE_MAX_DIMENSION=6`;
  `NCUBE_MAX_DIMENSION, ncubeVariants.length` → `6 5`.
- 3.3: mutation check flips to `# fail 1`, fixture restored.
- 3.4: `golden-ncube-v1.json` regenerates byte-identical; `test -s` true.
- 4.1–4.2: tsc and README checks above.
- 4.3: not a `(manual)` step, but its linked evidence file
  `evidence/step-4-3-demo-dimensions.png` exists (69,715 B) and the Reviewer's own
  re-drive confirms the described behavior.
- 5.1–5.2: `status: in-review`, `next-step: ""`, `git status --porcelain` empty, HEAD
  is the roadmap commit and equals `origin/feature/ncube-geometry-family`.

## Findings

1. **Minor — README support table timing column is not from the committed evidence
   run.** [README.md](../../../../README.md#L184-L190) lists median paint ms `0.041 /
   0.059 / 0.135 / 0.370 / 0.863 / 3.040 / 10.680` while
   [evidence/ncube-bounds.txt](evidence/ncube-bounds.txt) has `0.020 / 0.052 / 0.099 /
   0.278 / 0.958 / 3.150 / 10.352` (roadmap 4.2 says the table was "copied from" the
   evidence). Counts, bytes, edge lengths and the supported column agree, and every
   value is far inside the 5 ms criterion, so the conclusion is unaffected. Either
   regenerate the README column from the evidence file or label it as an indicative
   separate run.
2. **Minor — `NcubeParams` omits `strokeWidth`.** `prepareNcube` adds `strokeWidth`
   ([src/variants/ncube.js](../../../../src/variants/ncube.js#L157-L160)) and
   `handle.params` is the prepared object (asserted in `test/ncube.test.js` "static
   markup equals the mounted markup at rest"), so the runtime object carries one
   property the type does not declare. Non-breaking (extra property), but worth adding
   as `strokeWidth?: number` for accuracy.
3. **Note — legibility of face-painted finishes at d ≥ 5.** In the Reviewer's demo
   screenshots the shaded/two-tone 4-cube reads close to a plain cube and the 5-/6-cube
   silhouettes are near-identical; the nested cells are only unmistakable in wireframe
   ([review-demo-dimensions-wireframe.png](evidence/review-demo-dimensions-wireframe.png)).
   The plan's bound criteria (bytes, median edge length, paint time) are objective and
   met, so this is not a defect against the plan — recorded as a follow-up.
4. **Note — style.** `paintNcube` builds markup by string concatenation rather than
   template literals (skill best-practice 3); it deliberately mirrors
   `polyhedron.js`'s `renderInner` for consistency. No change requested.

No security-relevant surface was added: seeds are hashed, the demo inserts captions via
`document.createTextNode`, and all SVG attribute values are numeric or from fixed
palettes.

## Follow-ups

- Sync the README support-table paint-ms column with `evidence/ncube-bounds.txt` (or
  regenerate both from one run) — Finding 1.
- Add `strokeWidth?: number` to `NcubeParams` in `index.d.ts` — Finding 2.
- Evaluate a face-opacity or inner-cell shading treatment so shaded/two-tone
  tesseracts and higher cells read as nested at 64–72 px; a candidate for
  `ncube-motion-system` or a small follow-up issue — Finding 3.
