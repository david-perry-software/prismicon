# variant-tooling-review-fixes

## Problem

The `variant-build-tooling` feature (open PR #13, branch
`feature/variant-build-tooling`) shipped with four review findings that were accepted
as follow-ups instead of blocking the review:

1. **README "Adding a variant" recipe is wrong.** Step 2 of the maintainer recipe
   tells maintainers to register a built-in variant "by adding it to the
   `BUILT_IN_VARIANTS` registry **and re-exporting it from `src/index.js`**". Root
   descriptor re-exports are not required — `src/index.js` re-exports only the variant
   *machinery* — and following the recipe literally makes the pinned exports gate fail
   with `src/index.js export list drifted`.
2. **The plan's export count is wrong.** The variant-build-tooling plan claims
   `src/index.js` exports "12 core names + 6 variant names + `createPrismicon`" and
   later pins "the current 19 names"; the real count is 18 (11 core + 6 variant +
   `createPrismicon`), matching the script's own `EXPECTED_INDEX_EXPORTS` array.
3. **`check-variants` tests leak temporary fixture directories.** Each run of
   `test/check-variants.test.js` creates an `mkdtempSync` scratch dir under the OS
   temp dir and never removes it; the directories accumulate forever (13 leaked dirs
   observed on the planning machine after a handful of runs).
4. **The maintainer gate is not portable to Windows.** `scripts/check-variants.mjs`
   spawns `npm` directly; on Windows there is no `npm` executable (only `npm.cmd`), so
   `npm run check:variants` fails with ENOENT for any maintainer on Windows.

All four targets live only on the unmerged PR #13 branch, not on `origin/main`; see
`## Risks` for the resulting sequencing.

## Evidence

Verified against a detached worktree of PR #13 head (`74363c2`,
`origin/feature/variant-build-tooling`); full transcript in
[evidence/temp-dir-leak-reproduction.txt](evidence/temp-dir-leak-reproduction.txt).

- **Temp-dir leak (reproduced):** `/tmp/prismicon-check-*` count went 12 → 13 across a
  single `node --test test/check-variants.test.js` run; leaked dirs contain the two
  copied fixture files. Root cause: the scratch `mkdtempSync(join(tmpdir(),
  'prismicon-check-'))` in the "fails naming the registered id that has no golden
  entry" test is never removed.
- **Export count (reproduced):** `Object.keys(await import('./src/index.js'))` → 18
  names. Plan line 85 ("12 core names") and line 186 ("(the current 19 names)") are
  both wrong; `EXPECTED_INDEX_EXPORTS` in `scripts/check-variants.mjs` correctly lists
  18.
- **README recipe (verified against source):** registering in `BUILT_IN_VARIANTS`
  ([src/variants/index.js](../../../../src/variants/index.js)) is sufficient;
  `src/index.js` exports machinery only, and the exports check pins the exact list.
- **Windows portability (verified by inspection):** `spawnSync('npm', …)` in
  `checkPack()` has no `.cmd` fallback; Windows Node cannot resolve bare `npm`.

GitHub issue: #14

## Decisions

1. **Base branch strategy?** — **(a) Sequence.** Plan from `origin/main` normally.
   State explicitly in `## Risks` and the roadmap that implementation is blocked until
   PR #13 merges. Afterward, the Builder merges updated `origin/main` into the issue
   branch before writing the fixes. Keep the draft issue PR stalled until then.
2. **Scope?** — **Limit implementation to exactly the four findings.** Any additional
   observations should be documented as follow-ups, not expanded into this issue
   unless required to make one of the four fixes correct.
3. **Windows portability approach?** — Use `process.platform === 'win32' ? 'npm.cmd' :
   'npm'`. No new dependency is warranted for this maintainer script.
4. **Regression test?** — **Acceptable.** Use the temporary-directory leak as the
   required initially failing regression test. Verify the documentation findings with
   focused content assertions. Also add a focused assertion for npm command selection
   if it can be extracted into a small pure helper without introducing unnecessary
   abstraction; otherwise, verify both platform branches through a narrowly scoped
   script test or source assertion.

## Research

Skills consulted: `modern-javascript-patterns` (Node.js ESM maintainer script and
node:test changes); `vercel-react-best-practices` not loaded — no React code in scope.

Defect locations (all on PR #13 branch `feature/variant-build-tooling` @ `74363c2`;
line numbers from that branch):

- **README recipe:** `README.md` "## Adding a variant (maintainers)" step 2 (~line
  426-427) — the "and re-exporting it from `src/index.js`" clause must go; the recipe
  should state that registration in `BUILT_IN_VARIANTS` inside `src/variants/index.js`
  is the whole registration step and that root exports stay pinned to the machinery
  names (any new root export fails the `exports` check).
- **Export count:** `features/2026/09/variant-build-tooling/plan.md` line 85 ("12 core
  names + 6 variant names + `createPrismicon`" → "11 core names + 6 variant names +
  `createPrismicon` (18 total)") and line 186 ("(the current 19 names)" → "(the
  current 18 names)").
- **Temp-dir leak:** `test/check-variants.test.js` — the second test creates
  `mkdtempSync(join(tmpdir(), 'prismicon-check-'))` with no `t.after()`/cleanup. Fix:
  register cleanup via the `node:test` context (`t.after(() => rmSync(scratch,
  { recursive: true, force: true }))`) or `try/finally`.
- **Windows portability:** `scripts/check-variants.mjs` `checkPack()` —
  `spawnSync('npm', ['pack', '--dry-run', '--json'], …)`. Per decision 3, extract a
  tiny pure helper (e.g. `npmCommand(platform = process.platform)` returning
  `'npm.cmd'` on `win32`, else `'npm'`) so command selection is unit-testable on any
  host, and use it at the spawn site. No new dependency (no `cross-spawn`).

**Lint baseline (§5):** no lint is configured — AGENTS.md declares `Lint: none` and
the variant-build-tooling plan recorded `npm run lint` → `npm error Missing script:
"lint"`. Full-repository test baseline on `origin/main` @ `1a02709`: `npm test` →
exit 0, `# tests 130`, `# pass 130`, `# fail 0`. Gate decision: with no lint
configured there is nothing to scope; the gate for this issue is the full `npm test`
suite plus `npm run check:variants` (once PR #13 lands) staying green.

**Concurrent delivery (§ Risks):** `gh pr list` shows exactly one open PR — #13
`feature/variant-build-tooling` — and `gh pr diff 13 --name-only` includes every file
this issue touches (`README.md`, `scripts/check-variants.mjs`,
`test/check-variants.test.js`,
`features/2026/09/variant-build-tooling/plan.md`). Overlap is total and intentional:
this issue fixes PR #13's review findings and cannot start until it merges.

## Approach

Branch `issue/variant-tooling-review-fixes` was created from detached `origin/main`
(`1a02709`). Because none of the target files exist on `origin/main` yet, Phase 1
lands the exposing regression-test *harness additions* and documentation only after
integrating the post-#13 `origin/main`; concretely:

1. **Wait for PR #13, then integrate.** Once #13 merges, `git merge origin/main` into
   the issue branch (never rebase, per policy §7). All four target files then exist.
2. **Exposing regression test (fails first).** Extend `test/check-variants.test.js`
   with a test — header comment referencing `#14` / `variant-tooling-review-fixes` —
   that runs the suite's scratch-dir flow and asserts no `prismicon-check-*` directory
   remains in `tmpdir()` afterwards. Verified to FAIL against the unmodified file.
3. **Fix the leak.** Add `t.after()` cleanup (or `try/finally` + `rmSync … force:
   true`) around the scratch dir; the regression test now passes.
4. **Windows npm command.** Add the pure `npmCommand(platform)` helper to
   `scripts/check-variants.mjs` (exported for testability, or kept module-local with a
   source assertion if export would widen the surface), use it in `checkPack()`, and
   cover both `win32` and non-`win32` branches in `test/check-variants.test.js`.
5. **Documentation corrections.** Fix the two plan.md count lines and the README
   recipe step 2 wording; verify with focused content assertions (exact corrected
   strings present, wrong strings absent) in the test suite or as grep checks in the
   roadmap verify lines.

No changes to `src/`, `index.d.ts`, fixtures, or `package.json` are needed; the
published package surface is untouched.

## Risks

- **Blocked on PR #13 merge (accepted sequencing).** The defect targets exist only on
  `feature/variant-build-tooling`. Mitigation (user-approved decision 1): the roadmap
  keeps the draft PR stalled; the Builder's first build step is merging the updated
  `origin/main` (which then contains #13) into `issue/variant-tooling-review-fixes`
  before touching any file. If #13 changes materially before merge (e.g. the recipe or
  script is edited), re-verify the four findings still reproduce after integrating.
- **Concurrent-delivery overlap.** PR #13 is the only open delivery branch and
  overlaps this issue's file set completely; the mitigation is the sequencing above —
  no other open branches to conflict with (`gh pr list --state open` @ 2026-09-12).
- **Temp-dir assertion portability.** Counting `prismicon-check-*` dirs in `tmpdir()`
  could race with a parallel test run on a shared machine. Mitigation: the regression
  test counts dirs created by its own run (snapshot names before/after, or use a
  uniquely-named prefix via env override) rather than asserting a global count.
- **Helper abstraction creep.** Decision 4 allows the npm-command helper only if it
  stays "a small pure helper without introducing unnecessary abstraction"; if the
  Builder cannot keep it to a few lines, fall back to a source-level assertion on the
  ternary at the spawn site.
- **Lint gate.** None configured (see `## Research`); no waiver needed. If lint is
  introduced before this ships, reassess per policy §5.

## Out of scope

- Anything beyond the four listed findings, including the three documentation
  follow-ups already fixed inside PR #13 and any new observations — those are recorded
  as follow-ups, per decision 2.
- Adding a Windows CI job to prove portability end-to-end (nice-to-have; the helper
  unit assertions cover the regression).
- Refactoring `check-variants.mjs` structure, adding `cross-spawn`, or changing the
  `check:variants`/`verify` script wiring.
- Retroactively editing PR #13's review.md or roadmap.md history.

## Acceptance checklist

- [ ] The exposing regression test in `test/check-variants.test.js` (named/commented
  for #14 `variant-tooling-review-fixes`) FAILS on the branch before the fix and
  PASSES after — verified by running `node --test test/check-variants.test.js` at both
  points and capturing exit codes.
- [ ] After the fix, a full `npm test` run leaves zero newly created
  `prismicon-check-*` directories in the OS temp dir — verified by the before/after
  count in the regression test and by a manual `ls -d $TMPDIR/prismicon-check-*`
  comparison around `npm test`.
- [ ] `scripts/check-variants.mjs` selects `npm.cmd` on `win32` and `npm` elsewhere,
  with both branches covered by a focused assertion — verified by the new helper
  tests passing on Linux and by source inspection showing no bare `spawnSync('npm'`.
- [ ] README "## Adding a variant" step 2 no longer instructs root descriptor
  re-export and states registration in `BUILT_IN_VARIANTS` is sufficient — verified by
  a content assertion/grep for the corrected sentence and absence of "re-exporting it
  from `src/index.js`".
- [ ] `features/2026/09/variant-build-tooling/plan.md` states 11 core names and 18
  total exports in both corrected locations — verified by content assertions matching
  the real `Object.keys(await import('src/index.js'))` count of 18.
- [ ] `npm test` → exit 0 with the full suite green, and `npm run check:variants` →
  exit 0 with `✓ contract`, `✓ exports`, `✓ types`, `✓ pack`, `✓ goldens` — verified
  by running both on the branch after integrating the post-#13 `origin/main`.

## Resolution

**Root causes.** Four independent review findings from PR #13 (`variant-build-tooling`):
(1) the scratch-dir test in `test/check-variants.test.js` created an
`mkdtempSync(join(tmpdir(), 'prismicon-check-'))` fixture dir with no cleanup, leaking one
directory per run; (2) `checkPack()` in `scripts/check-variants.mjs` spawned bare `'npm'`,
which does not resolve on Windows (`npm.cmd` only); (3) the feature plan miscounted
`src/index.js` exports as "12 core … 19 names" where the real count is 11 core + 6 variant +
`createPrismicon` = 18; (4) the README maintainer recipe told maintainers to also re-export
new variant descriptors from `src/index.js`, which the pinned `exports` check forbids.

**What changed.**

- `test/check-variants.test.js` — the missing-golden test now takes the `node:test` context
  and registers `t.after(() => rmSync(scratch, { recursive: true, force: true }))`; added the
  #14 regression test (snapshots `prismicon-check-*` names in `tmpdir()` before the suite's
  scratch-dir flow and asserts none remain after) and a source assertion pinning the
  `npmCommand` win32/non-win32 ternary and its use at the `checkPack()` spawn site.
- `scripts/check-variants.mjs` — added module-local pure helper
  `npmCommand(platform = process.platform)` returning `'npm.cmd'` on `win32`, else `'npm'`;
  `checkPack()` now spawns `npmCommand()`.
- `features/2026/09/variant-build-tooling/plan.md` — corrected to "11 core names + 6 variant
  names + `createPrismicon` (18 total)" and "(the current 18 names)".
- `README.md` — "Adding a variant" step 2 now states that adding the descriptor to
  `BUILT_IN_VARIANTS` is the whole registration step and that root exports stay pinned (a new
  root export fails the `exports` check).

**Proof.**

- Regression test failed before the fix (`node --test test/check-variants.test.js` exit 1,
  `not ok 3 … leaked scratch dirs in tmpdir: prismicon-check-R7IaeW`) and passes after
  (exit 0, 4/4 in the file).
- Full suite green: `npm test` exit 0, 132 tests, 132 pass, 0 fail.
- No leak across a full run: `$TMPDIR/prismicon-check-*` count 25 → 25 around `npm test`.
- Maintainer gate green: `npm run check:variants` exit 0 with `✓ contract`, `✓ exports`,
  `✓ types`, `✓ pack`, `✓ goldens`; no bare `spawnSync('npm'` remains.

**Follow-ups.** None. (Note: 25 `prismicon-check-*` directories leaked by pre-fix runs may
still exist in maintainers' temp dirs; they are inert and can be deleted manually — no code
change warranted.)
