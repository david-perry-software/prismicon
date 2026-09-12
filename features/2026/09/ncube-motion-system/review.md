# Review: ncube-motion-system

Verdict: approve

Reviewed 2026-09-12 in worktree `/home/david/DP/prismicon-worktrees/plan-20260912-151357`,
branch `feature/ncube-motion-system` at `b8f6095` (draft PR #12). `git fetch origin`;
`git merge-base --is-ancestor origin/main HEAD` → true (branch contains `origin/main`
`b90aaba`). Diff reviewed: `git diff origin/main...HEAD` (15 files, +1419/−382).
Skills consulted: modern-javascript-patterns (pure `animate`, frozen poses, no
mutation, `const`/spread), vercel-react-best-practices (React regression test only; no
component change, `src/react.js` untouched).

## Acceptance checklist results

| # | Item | Result | Evidence (commands run by the Reviewer) |
|---|---|---|---|
| 1 | `npm test` exit 0, `# fail 0`, ≥ 114 + new tests; golden regen leaves `golden-v1.json` / `ncube-v1-identities.json` unchanged | **pass** | `npm test` → exit 0, `# tests 124`, `# suites 9`, `# pass 124`, `# fail 0` (baseline at `origin/main`: 114 pass; +10 new cases: `ok 22`–`ok 29`, `ok 33`, `ok 55`). `node scripts/generate-golden.mjs` exit 0; `git diff --quiet -- test/fixtures` exit 0; `git diff --quiet origin/main -- test/fixtures/golden-v1.json test/fixtures/ncube-v1-identities.json` exit 0 |
| 2 | `golden-ncube-v1.json` differs from `origin/main` only inside `mounted` blocks | **pass** | `bash evidence/static-equal.sh` → `static-equal: true`; independent `node -e` over both ids: `ncube static-equal true static entries 30 mounted changed true`, `ncube-4 static-equal true static entries 30 mounted changed true`; filtered diff lines are all `"hash"` entries |
| 3 | `poseNcube` returns frozen `{ ax, ay, az, theta }` with `theta === p.theta` for every state; static SVG byte-identical | **pass** | `ok 20 - hooks: pose returns the same frozen rest orientation for every state` (asserts identity of `theta` for `[...STATES, 'settling']`); item 2 static equality; `ok 35 - render: static markup equals the mounted markup at rest` |
| 4 | `deriveNcube` unchanged; `prepareNcube` adds the six traits deterministically within ranges | **pass** | `ok 15/16` freeze fixture tests in `ncube-derivation-freeze.test.js`; `ok 33 - prepare: motion traits are deterministic, within the documented ranges and spread across seeds`; roadmap 2.1 script rerun: six fields printed for all five seeds, `hyperSpeed === 0` iff `dimension === 3` (`true` ×5) |
| 5 | Working: `theta[d-4]` advances by `dir·hyperSpeed·dt`, higher planes at rest, d = 3 `theta` fixed and `spinAxis` at `spin3`; 60 frames inside `[0, 100]` | **pass** | `ok 22`, `ok 23`, `ok 24`; 2.3 rerun: `ncube-4 theta[0]` strictly monotone in `dir` over 10 frames, `ncube-3 theta unchanged: true` |
| 6 | Secondary states return a new differing object on frame 1; bursts opposite; `idle`/`done`/`error` return input; no mutation | **pass** | `ok 21`, `ok 25`, `ok 26`, `ok 27`; 3.2 rerun: d=4 send `+0.06408` / recv `−0.06408`, d=5 `+0.05126` / `−0.05126`, d=3 opposite on `spinAxis` (wrapped) |
| 7 | Settling returns `ctx.rest` by identity ≤ 60 frames; mounted glyph through every state ends at rest markup; working repaints | **pass** | `ok 28` (all seeds/dimensions); 3.2 rerun settled at frame 27 for d=3/4/5; `ok 36 - render: working repaints across frames and returns to the exact rest markup after idle`; `ok 40 - render: setState through every STATES entry never throws and settles back to rest`; browser: after `working` → `idle` all four `#lifecycle` glyphs `equalsStatic: true` vs `renderStaticSVG` |
| 8 | Reduced motion: zero frames, equals static markup; `validateVariant` passes for every id | **pass** | `ok 37 - render: reduced motion mount queues no frames and keeps the rest markup through states` (unchanged in diff); `ok 29 - hooks: validateVariant passes for ncube and every ncube-<d>` |
| 9 | React "hydration of an animated n-cube" passes | **pass** | `ok 55 - hydration of an animated n-cube has no recoverable errors and rotates after frames`; `git diff --quiet origin/main -- src/react.js` exit 0 |
| 10 | Frame benchmark: median ≤ 2 ms, p95 ≤ 4 ms, settling ≤ 60 frames; README carries the frame column | **pass** | `node scripts/measure-ncube.mjs` exit 0, last line `frame gate: pass`; fresh run worst case d=6 two-tone median 0.291 ms / p95 0.697 ms, settle 28–31 frames; committed `evidence/ncube-motion-frames.txt` contains `frame gate: pass` (1); README table has `median frame ms (shaded)` column (L218) |
| 11 | `NcubeParams` declares the prepared fields; `tsc` prints exactly one `error TS` naming `'react'` | **pass** | `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts` → 1 error: `index.d.ts(244,63): error TS7016 … module 'react'` (pre-existing); diff adds `strokeWidth`, `dir`, `hyperSpeed`, `spinAxis`, `spin3`, `phase`, `phase2` as `readonly …?` |
| 12 | README no longer says static, documents the motion model, section order unchanged | **pass** | `grep -c "deliberately static" README.md` → 0; `grep -c "Motion model"` → 1; `grep -n "^## "` order (Install … Variants, Custom variants, Derivation spec v1 (frozen), Performance, License) identical to `git show origin/main:README.md` |
| 13 | Demo at `local:3173` shows the Lifecycle row + strip; screenshots of `working` and `thinking`; responsive with four dimensions animating | **pass** | `ss -ltn \| grep -c ':3173 '` → 0; served `python3 -m http.server 3173 --directory .`; row present with 4 glyphs and 9 state buttons. After `working`: all four `<g>` bodies changed between samples 400 ms apart, aria-labels `…, working`, two back-to-back rAFs 22.6 ms. After `thinking`: all four changed, 23.7 ms, dashed ring visible. Seed `build-bot-7` re-mounted four two-tone glyphs in the current state. Reviewer screenshots: [evidence/review-lifecycle-working.png](evidence/review-lifecycle-working.png), [evidence/review-lifecycle-thinking.png](evidence/review-lifecycle-thinking.png). Server killed afterwards |
| 14 | Untouched-file contract; polyhedron diff adds only `export` to `angDiff`/`wrapAngle` | **pass** | `git diff --quiet origin/main -- src/core.js src/react.js src/index.js src/variants/registry.js src/variants/validate.js src/variants/index.js src/variants/seed.js package.json test/fixtures/golden-v1.json test/fixtures/ncube-v1-identities.json` exit 0; polyhedron stat `2 insertions(+), 2 deletions(-)`, the four changed lines are exactly `-function`/`+export function` for both helpers |
| 15 | `npm pack --dry-run` lists nothing under `test/`, `scripts/`, `features/` | **pass** | count 0; 14 files: LICENSE, README.md, index.d.ts, package.json, `src/**` |

Lint gate (policy §5): AGENTS.md declares `Lint: none`, so the gate is the full
`npm test`; fresh run 124/124 vs recorded baseline 114/114 at `origin/main`, no
failures, no new findings.

## Plan vs implementation

- `animateNcube` implements every state exactly as tabulated in plan `## Approach`
  (rates `k(3)`, `k(3.5)`, `k(2.2)`, `k(1.2)`, `k(4)`, `k(4.5)`; targets, cascade
  `0.4^(top-i)`, burst `3.2·exp(−7·transientT)`, settle epsilon 0.015). Trait
  derivation matches the plan table bit-for-bit (`hash % 2`, `⌊hash/2⌋ % 256`,
  `⌊hash/512⌋ % 3`, `⌊hash/1536⌋ % 256`).
- Deviation (benign): the plan says "any frame that changes nothing returns the input
  `pose`". Only `idle`/`done`/`error` do so; `waiting`/`thinking`/`sleeping` always
  allocate a new frozen object even if it would equal the input. With sinusoidal
  targets this case does not arise in practice and `settling` handles the terminal
  case by returning `ctx.rest`, so the engine contract (§Research) is met.
- Deviation (benign): in `working`, `theta[i]` for `i > top` keeps its current value
  rather than easing to rest. Those planes are unused by `projectTo3` for that
  dimension and no state moves them, so they stay at rest in practice (asserted by
  `ok 22`).
- Undocumented change (in scope): `test/react-variant.test.js` `installDom` gained a
  queued-rAF `advanceAnimationFrame` helper and a `#scratch` node; the STATES-cycle
  test repair is recorded on roadmap step 3.3 and preserves its intent.
- README trait ranges (`0.55–0.90 rad/s`, `±0.22`, `±0.45–0.85`) match the code
  constants.

## Roadmap audit

Every ticked box was spot-checked against the codebase and by rerunning its `verify:`
(1.1, 1.4, 2.1, 2.3, 3.1, 3.2, 4.2, 4.3, 5.1–5.4, 6.1, 6.2 rerun directly; 1.2, 1.3,
2.2, 2.4, 3.3, 3.4, 4.1 via the full suite). No falsely ticked boxes. Step 5.4's
screenshots exist and are committed (`git ls-files` lists both). No `(manual)` or
`(manual, post-ship)` steps. No repairs were needed; roadmap.md is unchanged by this
review.

## Findings

1. **Minor** — README support-table "median frame ms (shaded)" values (`0.032`,
   `0.081`, `0.236` for d = 4/5/6 in [README.md](../../../../README.md#L218-L225))
   do not match the committed
   [evidence/ncube-motion-frames.txt](evidence/ncube-motion-frames.txt) (`0.033`,
   `0.079`, `0.227`) that the paragraph says they are "recorded in". Timing noise
   between runs; the pre-existing static-paint column has the same drift versus
   `ncube-bounds.txt`, so this is cosmetic, but the two should be synced in a
   follow-up.
2. **Minor** — [test/react-variant.test.js](../../../../test/react-variant.test.js#L74-L76)
   "hydration of an animated n-cube" depends on running before any other mounting
   test because the engine in `src/core.js` is a module singleton. The dependency is
   documented in the test comment and the file order satisfies it; a per-test core
   import (as `test/ncube.test.js` does with `?query` cache-busting) is not possible
   through `src/react.js`, so this is accepted.
3. **Info** — [index.d.ts](../../../../index.d.ts#L52-L57): the block comment
   "Prepared, non-identity fields below…" sits directly above `strokeWidth`'s own
   JSDoc; TypeScript attaches only the nearer comment, so the umbrella note is not
   surfaced in hover docs. Harmless.
4. Security: no concerns. The change is pure arithmetic over params/pose; the demo row
   uses `textContent`/`createTextNode` for user-derived text and the seed reaches the
   DOM only through `setAttribute('aria-label', …)` in the existing renderer.

## Follow-ups

- Sync the README `median frame ms (shaded)` column with the committed
  `evidence/ncube-motion-frames.txt` values (or state that the column is from a
  separate run) — finding 1.
