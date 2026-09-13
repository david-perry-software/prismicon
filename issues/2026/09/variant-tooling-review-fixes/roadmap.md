```yaml
status: in-review
branch: issue/variant-tooling-review-fixes
last-updated: 2026-09-12
next-step: "done"
github-issue: "#14"
```

## Phase 1: Unblock and expose

- [x] 1.1 Confirm PR #13 (`feature/variant-build-tooling`) is merged to `main`
  (`gh pr view 13 --json state` → `MERGED`); if still open, stop here and leave this
  roadmap stalled — verify: `gh pr view 13 --json state --jq .state` prints `MERGED`
- [x] 1.2 Integrate the post-#13 default branch: `git fetch origin && git merge
  origin/main` (merge, never rebase) so `scripts/check-variants.mjs`,
  `test/check-variants.test.js`, the README recipe, and the variant-build-tooling
  plan exist on this branch — verify: `git log --oneline -1 origin/main` is an
  ancestor (`git merge-base --is-ancestor origin/main HEAD`) and `ls
  scripts/check-variants.mjs test/check-variants.test.js` succeeds
- [x] 1.3 Re-confirm all four findings still reproduce on the integrated tree (PR #13
  may have drifted before merge): leak via before/after count of
  `$TMPDIR/prismicon-check-*` around `node --test test/check-variants.test.js`; wrong
  count via `grep -n "19 names\|12 core"
  features/2026/09/variant-build-tooling/plan.md`; recipe via `grep -n "re-exporting
  it from" README.md`; Windows via `grep -n "spawnSync('npm'"
  scripts/check-variants.mjs` — verify: all four greps/counts still show the defect;
  if any finding no longer reproduces, mark the dependent fix steps obsolete with the
  reason and update plan.md
- [x] 1.4 Add the exposing regression test to `test/check-variants.test.js` — header
  comment `// Regression test for #14 (variant-tooling-review-fixes): scratch fixture
  dirs must be removed`; snapshot `readdirSync(tmpdir())` names matching
  `/^prismicon-check-/` before and after running the existing scratch-dir flow and
  assert no new names remain — verify: `node --test test/check-variants.test.js`
  exits nonzero and the failure output names the leaked `prismicon-check-` directory

## Phase 2: Fix the defects

- [x] 2.1 Fix the temp-dir leak: pass the `node:test` context into the scratch-dir
  test and register `t.after(() => rmSync(scratch, { recursive: true, force: true
  }))` (or wrap in `try/finally`) — verify: the 1.4 regression test now passes and
  `node --test test/check-variants.test.js` exits 0
- [x] 2.2 Make npm invocation portable: add a small pure helper in
  `scripts/check-variants.mjs` (e.g. `const npmCommand = (platform =
  process.platform) => platform === 'win32' ? 'npm.cmd' : 'npm'`) and use it at the
  `checkPack()` spawn site; keep it module-local unless an export is needed for
  testing — verify: `grep -n "spawnSync('npm'" scripts/check-variants.mjs` finds no
  bare `'npm'` spawn and `npm run check:variants` still exits 0 on Linux
- [x] 2.3 Cover both npm-command branches in `test/check-variants.test.js` (call the
  helper with `'win32'` and `'linux'`; if the helper stayed module-local, assert the
  ternary source text instead per plan decision 4) — verify: `node --test
  test/check-variants.test.js` exits 0 including the two new assertions
- [x] 2.4 Correct the export count in
  `features/2026/09/variant-build-tooling/plan.md`: line ~85 "12 core names + 6
  variant names + `createPrismicon`" → "11 core names + 6 variant names +
  `createPrismicon` (18 total)" and line ~186 "(the current 19 names)" → "(the
  current 18 names)" — verify: `grep -n "19 names\|12 core"
  features/2026/09/variant-build-tooling/plan.md` finds nothing and `grep -n "18
  names\|11 core" features/2026/09/variant-build-tooling/plan.md` matches both lines
- [x] 2.5 Correct the README "## Adding a variant (maintainers)" step 2: drop "and
  re-exporting it from `src/index.js`" and state that adding the descriptor to
  `BUILT_IN_VARIANTS` in `src/variants/index.js` is the whole registration step (root
  exports stay pinned to the machinery names; a new root export fails the `exports`
  check) — verify: `grep -n "re-exporting it from" README.md` finds nothing and the
  corrected sentence is present

## Phase 3: Verify and hand off

- [x] 3.1 Run the full verification battery: `npm test` and `npm run check:variants`
  — verify: `npm test` exits 0 with the whole suite green and `npm run
  check:variants` exits 0 printing `✓ contract`, `✓ exports`, `✓ types`, `✓ pack`,
  `✓ goldens`
- [x] 3.2 Prove no new temp dirs leak across a full suite run: count
  `$TMPDIR/prismicon-check-*` before and after `npm test` — verify: counts are equal
- [x] 3.3 Record any out-of-scope observations made during the build as Follow-ups in
  this roadmap (per plan decision 2) and update plan.md `## Resolution` with root
  cause, changes, and proof the 1.4 test passes — verify: plan.md `## Resolution` is
  filled and `git status` shows no unrelated changes
