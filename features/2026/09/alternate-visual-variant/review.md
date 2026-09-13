# Review: alternate-visual-variant

Verdict: approve

Reviewed 2026-09-13 in worktree `/home/david/DP/prismicon-worktrees/plan-20260913-033207`,
branch `feature/alternate-visual-variant` at `2aca4e6` (draft PR #16). Roadmap resolved
via `agento.mjs resolve feature alternate-visual-variant` → `status: ok`, source local,
branch matches. `git fetch origin`; the worktree list confirms this worktree owns
`feature/alternate-visual-variant`; `git merge-base --is-ancestor origin/main HEAD` →
true (branch contains `origin/main` `f60a4c0`). Diff reviewed:
`git diff origin/main...HEAD` (20 files, +2743/−17, including plan/roadmap/evidence).
Skills consulted: modern-javascript-patterns (pure hooks, frozen pose/geometry objects,
spread over mutation, no shared mutable state in `animate` — all observed in
[src/variants/orbit.js](../../../../src/variants/orbit.js)); vercel-react-best-practices
(React change is a hydration regression test only; `src/react.js` untouched, so no
component-level rules are implicated).

## Acceptance checklist results

| # | Item | Result | Evidence (commands run by the Reviewer) |
|---|---|---|---|
| 1 | `npm test` exit 0, `# fail 0`, ≥ 132 + new orbit tests; `npm run check:variants` exit 0 | **pass** | `npm test` → exit 0, `# tests 160`, `# pass 160`, `# fail 0` (baseline at `origin/main`: 132; +28 from the orbit suites). `npm run check:variants` → exit 0, all five `✓` lines (contract, exports, types, pack, goldens) |
| 2 | `listVariants()` ids end in `'orbit'` with `{ id: 'orbit', label: 'Orbit', spec: 'orbit-v1' }`; root exports unchanged (18 pinned names) | **pass** | `node -e … listVariants()` prints `polyhedron,ncube,ncube-3,ncube-4,ncube-5,ncube-6,orbit` with labels/specs as planned; `Object.keys(await import('./src/index.js')).sort().length` → 18 and `test/prismicon.test.js` "src/index.js exports exactly the eighteen names" passes; `git diff --quiet origin/main -- src/index.js` exit 0 |
| 3 | `deriveOrbit` pinned by `orbit-v1-identities.json`; module header documents the frozen 22-draw order | **pass** | [test/orbit-derivation-freeze.test.js](../../../../test/orbit-derivation-freeze.test.js) passes (in the 160); header of [src/variants/orbit.js](../../../../src/variants/orbit.js) documents the 22-draw order and the spec-bump rule; [test/orbit.test.js](../../../../test/orbit.test.js) "every one of the 22 spec draws is made regardless of ringCount" replays the draw order inline |
| 4 | Golden regen leaves v1/ncube fixtures untouched; `golden-orbit-v1.json` has a single `orbit` key | **pass** | `node scripts/generate-golden.mjs` exit 0; `git diff --quiet -- test/fixtures/golden-v1.json test/fixtures/golden-ncube-v1.json test/fixtures/ncube-v1-identities.json` exit 0; `git status --porcelain test/fixtures` empty after regen; [test/golden-orbit.test.js](../../../../test/golden-orbit.test.js) asserts the single-key shape and byte-identity |
| 5 | `poseOrbit` returns a frozen identical rest pose for every state; static == mounted at rest; reduced-motion == static in every state | **pass** | `test/orbit.test.js` cases "pose returns the same frozen rest pose for every state" (`[...STATES, 'settling']`), "static markup equals the mounted markup at rest" (five seeds), "reduced motion mount queues no frames and equals the static markup in every state" (0 queued frames asserted per state) |
| 6 | Motion contract per state: working counter-rotation, first-frame change for secondary states, opposite bursts, identity returns for `idle`/`done`/`error`, no mutation | **pass** | `test/orbit.test.js` cases "working advances each ring by ringSpeeds[r] * dt with adjacent rings counter-rotating" (1e-9 tolerance over 10 frames × 5 seeds), "waiting, thinking and sleeping change the pose on the first frame", "sending and receiving burst the outermost ring in opposite directions" (`ds > 0`, `dr < 0`, `ds + dr < 1e-12`), "animate returns its input for idle/done/error", "animate never mutates a frozen input pose" |
| 7 | `settling` returns `ctx.rest` by identity ≤ 60 frames; mounted glyph through every state ends at rest markup; 60 working frames inside `[0, 100]` | **pass** | "settling eases every offset to rest and returns ctx.rest by identity within 60 frames" (perturbed +0.5 rad / coreScale 1.4, all seeds); "working repaints across frames and returns to the exact rest markup after idle"; "setState through every STATES entry never throws and settles back to rest"; "60 working frames keep every emitted coordinate inside the viewBox" |
| 8 | `validateVariant(orbit)` passes | **pass** | "hooks: validateVariant passes for orbit" in `test/orbit.test.js`; `✓ contract` in `npm run check:variants` |
| 9 | React hydration case passes; `src/react.js` untouched | **pass** | `node --test test/react-variant.test.js` lists "hydration of an animated orbit has no recoverable errors and rotates after frames" as `ok` (SSR == `renderStaticSVG`, zero recoverable errors, `<g>` changes over frames); `git diff --quiet origin/main -- src/react.js` exit 0 |
| 10 | Benchmark evidence shows both gates passing; README cites the measured median frame value | **pass** | Reviewer reran `node scripts/measure-orbit.mjs` → exit 0, `static gate: pass`, `frame gate: pass` (median 0.007–0.012 ms, p95 ≤ 0.096 ms, settle 29–31 frames on this machine); committed [evidence/orbit-benchmark.txt](evidence/orbit-benchmark.txt) contains both `gate: pass` lines (`grep -c` → 2); README `### Orbit` cites median frame 0.007–0.012 ms, matching the evidence. (See finding 1 for the p95 clause.) |
| 11 | `index.d.ts`: `'orbit'` in `BuiltInVariantId`, `OrbitParams`, widened `GlyphHandle.params` union; `types` check passes | **pass** | Diff of [index.d.ts](../../../../index.d.ts) adds exactly those three plus the narrowing JSDoc; `✓ types` in `npm run check:variants` (`tsc --noEmit --strict` over `index.d.ts`) |
| 12 | README lists `orbit` and documents the `### Orbit` subsection; section order unchanged | **pass** | `grep -c "### Orbit" README.md` → 1; `grep -c "orbit" README.md` → 11 (≥ 8); `## ` section names/order identical to `git show origin/main:README.md`; the subsection covers design, frozen `orbit-v1` draw order, per-state motion table, no-new-draws rule and reduced-motion behavior. (See findings 1–2 for two in-section numeric/example inaccuracies.) |
| 13 | Demo at `local:3179` shows the Orbit row; `working`/`thinking`/`sending` visibly animate; page responsive; screenshots committed | **pass** | Reviewer re-drove it: `ss -ltn \| grep -c ':3179 '` → 0, served `python3 -m http.server 3179 --directory .`, opened the demo. Orbit row present with seed input and 9 state buttons. `working`: `<g>` innerHTML differed across samples 400 ms apart, aria `…, working`. `thinking`: animates, 7 `<circle>` nodes present. `sending`: 8 distinct `<g>` samples within ~500 ms of the click (burst), settling back to rest afterwards; page stayed responsive throughout. Reviewer screenshots: [evidence/review-orbit-working.png](evidence/review-orbit-working.png), [evidence/review-orbit-thinking.png](evidence/review-orbit-thinking.png); Builder's [evidence/step-5-4-orbit-working.png](evidence/step-5-4-orbit-working.png) and [evidence/step-5-4-orbit-thinking.png](evidence/step-5-4-orbit-thinking.png) are committed and contain the glyph (pixel analysis: 546/1144 non-background pixels, 376/747 colored). Server killed afterwards (`:3179` listener count 0) |
| 14 | Untouched-file contract; `npm pack --dry-run` lists nothing under `test/`, `scripts/`, `demo/`, `features/` | **pass** | `git diff --quiet origin/main -- src/core.js src/react.js src/index.js src/variants/registry.js src/variants/validate.js src/variants/seed.js src/variants/polyhedron.js src/variants/ncube.js package.json test/fixtures/golden-v1.json test/fixtures/golden-ncube-v1.json test/fixtures/ncube-v1-identities.json` exit 0; `git diff origin/main -- src/variants/index.js` is exactly the orbit import/export/registration (3 hunks, 4 lines); pack exclusion grep count → 0 |

Lint gate (policy §5): AGENTS.md declares `Lint: none`, so the gate is the full
`npm test` plus `npm run check:variants`; fresh run 160/160 vs the plan's recorded
baseline 132/132 at `origin/main` `f60a4c0`, no failures, no new findings.

## Plan vs implementation

- `deriveOrbit` implements the frozen `orbit-v1` draw order exactly as planned
  (ringCount, 4 nodeCounts, 16 nodeAngles, coreMark — 22 draws, all made regardless
  of `ringCount`; hues from `hash`, not PRNG). The draw-order independence test
  replays all 22 draws inline and the identity fixture pins the five golden seeds.
- `motionTraits` matches the plan table bit-for-bit: `dir = hash % 2`, per-ring bytes
  at bits `1+8r … 8+8r` (`Math.floor(hash / 2 ** (1 + 8 * r)) % 256`), phase at bits
  33–40; speeds in `[0.5, 1.0]` with alternating signs. No new PRNG draws — the
  derivation-freeze and golden-static tests confirm the spec surface is unchanged.
- `animateOrbit` implements every state with the planned rates and targets
  (`k(3)` working breathing ±0.06, `k(3.5)` waiting sway ±0.04, `k(2.2)` thinking
  wobble ±0.08 with core pulse +0.10, `k(1.2)` sleeping breath around 0.85, burst
  `(0.5 + |ringSpeeds[top]|) · 3.2 · exp(−7·transientT)` with opposite signs,
  `k(4.5)` settling with the 0.015 / 0.01 epsilons and the `ctx.rest`
  return-by-identity). `idle`/`done`/`error` return the input object. All rates and
  magnitudes are within the plan (thinking's `k(2.2)` comes from roadmap step 2.3;
  plan.md left that rate to the roadmap).
- `paintOrbit` mirrors the established `ink()`/`shadeFor` pattern (dark lightness
  table, sleeping dimming, `dx` shake offset, `lighten`, `lerpHue` flash), emits
  `toFixed(1)` coordinates, and keeps the 26-unit silhouette bound — all asserted in
  tests. `flashOrbit` matches `flashNcube`'s mapping, including the
  `effects.flash.hue ?? p.hue` / `strength` convention.
- Consistent with the ncube precedent, `prepareOrbit` returns an unfrozen params
  spread with an unfrozen `ringSpeeds` array — same shape as `prepareNcube`, and the
  "prepared, not derived" convention is documented in `index.d.ts`.
- No deviations from the plan's affected-files list were found: every "New" file
  exists, every "Edited" file's diff is confined to the planned surface, and every
  "Not touched" file is verified untouched by the item-14 command.

## Roadmap audit

Every ticked box was spot-checked against the codebase and by rerunning its
`verify:` command where CLI-executable: 1.1 (module exports + `validateVariant`),
1.2 (registration, pinned assertions, `listVariants` output), 1.3–1.5 (golden row,
freeze fixture, regen isolation), 2.1 (trait ranges across the five seeds — via the
test suite), 2.2–2.5 (motion cases in the 160-test run), 2.6 (regen clean,
`npm test` exit 0), 3.1–3.2 (benchmark rerun, both gates pass, evidence committed
with 2 `gate: pass` lines), 4.1 (react suite + untouched `src/react.js`), 5.1
(`✓ types`), 5.2 (grep counts and section order), 5.3–5.4 (re-driven in a browser by
the Reviewer — see checklist item 13 — with the Builder's committed screenshots
verified by pixel analysis), 6.1–6.3 (full gate, untouched-file contract,
`gh pr view` → PR #16 OPEN, `isDraft: true`, `headRefName:
feature/alternate-visual-variant`). Steps 5.3/5.4 are the manual browser steps and
have their linked committed evidence per §3; the Reviewer independently re-drove the
target per §2. No falsely ticked boxes, no missing-work steps to add, no
`(manual, post-ship)` steps. No repairs were needed; roadmap.md is unchanged by this
review.

## Findings

1. **Minor** — README `### Orbit` benchmark paragraph claims "p95 ≤ 0.030 ms" for
   "the 2026-09-13 run recorded in
   [evidence/orbit-benchmark.txt](evidence/orbit-benchmark.txt)", but that file
   records maya at p95 0.059 ms (Reviewer's fresh run: 0.096 ms). The cited median
   ranges (paint 0.006–0.011 ms, frame 0.007–0.012 ms) and settle counts (29–31)
   do match the evidence; only the p95 clause is off. Sync the number or drop the
   clause in a follow-up.
2. **Minor** — README `### Orbit` aria example reads `maya: 2-ring orbit, 3 nodes,
   plus core`, but `describeOrbit(deriveOrbit('maya'))` returns `2-ring orbit, 3
   nodes, dot core` (also what the demo renders and what
   [test/fixtures/orbit-v1-identities.json](../../../../test/fixtures/orbit-v1-identities.json)
   pins). The example's ring/node counts are right; only the core mark is wrong.
3. **Info** — `paintOrbit`'s `point()` helper builds a `"x y"` string that the node
   loop immediately `.split(' ')`s back apart. Harmless at ≤ 16 nodes (median paint
   0.006–0.011 ms) and keeps the `toFixed(1)` formatting in one place; noted only
   for completeness.
4. Security: no concerns. The change is pure arithmetic over params/pose; the demo
   row uses `createTextNode` for the label and the seed reaches the DOM only through
   the existing renderer's `aria-label`.

## Follow-ups

- Fix the two README `### Orbit` inaccuracies (findings 1–2): p95 clause vs
  `evidence/orbit-benchmark.txt`, and the `maya` aria example's `plus core` →
  `dot core`.
