# Review: variant-tooling-review-fixes

Verdict: approve

Reviewed on 2026-09-12 against `origin/main` (ancestor of `HEAD` @ `a750f3a`).
Skills loaded: `modern-javascript-patterns` (Node.js ESM maintainer script and
node:test changes); no React code in scope, so `vercel-react-best-practices` not
loaded — matching the plan's `## Research`.

## Acceptance checklist results

1. **Exposing regression test fails before the fix and passes after — PASS.**
   At `c3feb97` (pre-fix), run in a detached worktree with `node_modules` linked:
   `node --test test/check-variants.test.js` → exit 1, `not ok 3 - scratch fixture
   dirs are removed after the missing-golden flow runs` with
   `leaked scratch dirs in tmpdir: prismicon-check-6itfEl` (tests 1–2 pass). At
   `HEAD` the same file passes 4/4. Because the fix commit `47f3e89` also rewrote
   the regression test (see Findings 1), I additionally proved the *current* test
   version guards the fix: in a detached worktree at `HEAD` with the `t.after(…)`
   line removed, the run exits 1 with exactly test 3 failing
   (`leaked scratch dirs in tmpdir: prismicon-check-ViHqSH`); with the line
   restored it passes. Both directions verified with captured exit codes.
2. **Full `npm test` leaves zero new `prismicon-check-*` dirs — PASS.** Counted
   `ls -d /tmp/prismicon-check-* | wc -l` around `npm test` on the branch:
   32 → 32, `npm test` exit 0.
3. **`npm.cmd` on `win32`, `npm` elsewhere, both branches covered, no bare spawn —
   PASS.** [scripts/check-variants.mjs](../../../../scripts/check-variants.mjs#L50-L51)
   adds the pure `npmCommand(platform = process.platform)` ternary and
   [checkPack()](../../../../scripts/check-variants.mjs#L106) spawns
   `npmCommand()`. `grep -n "spawnSync('npm'" scripts/check-variants.mjs` → no
   match (exit 1). Both branches pinned by the source-assertion test
   `check-variants spawns npm.cmd on win32 and npm elsewhere`, which passes.
   Module-local helper + source assertion is the fallback plan decision 4
   explicitly permits (the script self-executes on import, so exporting the helper
   would widen the surface).
4. **README recipe no longer demands root re-export — PASS.** `grep -n
   "re-exporting it from" README.md` → no match. [README.md step 2](../../../../README.md#L426-L428)
   now states registration in `BUILT_IN_VARIANTS` "is the whole registration step"
   and that a new root export fails the `exports` check.
5. **Plan export counts corrected to 11 core / 18 total — PASS.**
   [features/2026/09/variant-build-tooling/plan.md](../../../../features/2026/09/variant-build-tooling/plan.md#L85-L86)
   reads "11 core names + 6 variant names + `createPrismicon` (18 total)" and
   [line 186](../../../../features/2026/09/variant-build-tooling/plan.md#L186)
   "(the current 18 names)"; `grep -n "19 names\|12 core"` → no match.
   Independently verified: `Object.keys(await import('./src/index.js'))` → 18 names.
6. **`npm test` and `npm run check:variants` green — PASS.** Ran both on the
   branch: `npm test` exit 0, `# tests 132`, `# pass 132`, `# fail 0`; `npm run
   check:variants` exit 0 printing `✓ contract`, `✓ exports`, `✓ types`, `✓ pack`,
   `✓ goldens`.

## Plan vs implementation

No gaps. The diff (`git diff origin/main...HEAD`) touches exactly the four planned
targets — [test/check-variants.test.js](../../../../test/check-variants.test.js),
[scripts/check-variants.mjs](../../../../scripts/check-variants.mjs),
[README.md](../../../../README.md),
[features/2026/09/variant-build-tooling/plan.md](../../../../features/2026/09/variant-build-tooling/plan.md)
— plus this issue's own artifacts. No `src/`, `index.d.ts`, fixture, or
`package.json` changes, matching the plan's "published package surface is
untouched". The one deviation from the literal step text is the regression-test
rewrite inside `47f3e89` (Findings 1); the delivered design (load-time snapshot +
post-flow assertion) still satisfies the plan's requirement and its risk
mitigation (snapshot names rather than a global count).

## Roadmap audit

All 12 boxes ticked; spot-checked every one against the codebase and live runs:

- 1.1 ✓ `gh pr view 13 --json state --jq .state` → `MERGED`.
- 1.2 ✓ `git merge-base --is-ancestor origin/main HEAD` holds; both target files
  exist on the branch.
- 1.3 ✓ Re-verified the four defects were present at the re-confirmation commit
  `d766b7d`: README "re-exporting it from" (1 match), `spawnSync('npm'` (1 match),
  "19 names|12 core" (2 matches); the leak is demonstrated by the `c3feb97`
  failing run.
- 1.4 ✓ Verified by the `c3feb97` run above (exit 1, leaked dir named).
- 2.1 ✓ `t.after(() => rmSync(scratch, { recursive: true, force: true }))` present;
  regression test passes.
- 2.2 ✓ Helper + spawn-site change present; no bare `'npm'` spawn;
  `npm run check:variants` exit 0 on Linux.
- 2.3 ✓ Source-assertion test covers both branches; passes (plan decision 4
  fallback).
- 2.4 / 2.5 ✓ Greps and corrected sentences verified (checklist items 4–5).
- 3.1 / 3.2 ✓ Ran myself; results under checklist items 2 and 6.
- 3.3 ✓ plan.md `## Resolution` is filled with root cause, changes, and proof;
  `git status` clean before this review.

No falsely ticked boxes found; no missing-work steps needed; no repairs made. No
`(manual)` or `(manual, post-ship)` steps exist, so §3/§4 evidence rules do not
apply. Lint gate (§5): none configured (`Lint: none` in AGENTS.md), matching the
plan's recorded baseline — nothing to scope.

## Findings

1. **(minor) The fix commit rewrote the regression test it was meant to satisfy.**
   `47f3e89` both added the `t.after` cleanup and replaced the `c3feb97` version of
   the regression test. The rewrite was necessary — the original version created
   its own `mkdtempSync` scratch dir and never removed it, so it would have failed
   forever, including post-fix — but it means the current test text never ran
   against the pre-fix code in history. I closed the evidence gap directly
   (HEAD-minus-`t.after` → exit 1 naming the leaked dir; HEAD → exit 0), so
   acceptance item 1 still passes. Ideally the rewrite would have been a separate
   commit with its own fails-first run recorded.
2. **(minor) The leak regression test is order-dependent.** The load-time
   `scratchDirsAtLoad` snapshot and the assertion rely on top-level node:test
   sequential execution and on the missing-golden test running first; if that test
   is ever skipped or reordered, the leak test passes vacuously. The code comments
   document the assumption; acceptable for this suite.
3. **(minor) npm-command coverage is a source-text regex.** The assertions in
   [test/check-variants.test.js](../../../../test/check-variants.test.js#L60-L64)
   pin exact ternary formatting; a future reformat (e.g. added whitespace) would
   break the test without a behavior change. This is the sanctioned fallback in
   plan decision 4 and keeps the script surface unchanged — noted for awareness
   only.

Code otherwise follows the `modern-javascript-patterns` guidance: `const` by
default, small pure arrow-function helper, template literals, no new dependencies.

## Follow-ups

None. (Note: `prismicon-check-*` dirs leaked by historical pre-fix runs remain in
maintainers' temp dirs and are inert, as plan.md `## Resolution` records; scratch
dirs leaked by this review's own pre-fix verification runs were removed.)
