# Review: variant-build-tooling

Verdict: approve

Reviewed 2026-09-12 at HEAD `cd093ef` (PR #13, draft, `feature/variant-build-tooling` → `main`;
`origin/main` `1a02709` is an ancestor of HEAD; `mergeStateStatus: CLEAN`). Node v22.22.3,
npm 10.9.8, `npm ci` from the committed lockfile (typescript 7.0.2, @types/react 19.3.0).

Skills consulted: modern-javascript-patterns (`.agents/skills/modern-javascript-patterns/SKILL.md`
— ESM, `const`, array methods, small pure async functions, template literals; the check script
and golden-capture refactor follow it). `vercel-react-best-practices` not loaded: no React code
changed (`src/react.js` untouched, `git diff --quiet origin/main -- src` → 0).

Every command below was re-run by the Reviewer in this worktree; nothing is taken from the
Builder's notes.

## Acceptance checklist results

Score: **13 / 13 pass** (0 fail, 0 deferred).

1. **`npm run check:variants` exits 0 with one `✓` per check** — pass. Output: `✓ contract`,
   `✓ exports`, `✓ types`, `✓ pack`, `✓ goldens`, `check-exit=0`.
   `node --test test/check-variants.test.js` → `# tests 2`, `# pass 2`, `# fail 0`.
2. **Fixtures lacking `ncube-5` → non-zero exit naming `ncube-5` and `generate-golden.mjs`** —
   pass. Built `/tmp/vbt-rev/golden-ncube-v1.json` without `ncube-5`;
   `PRISMICON_CHECK_FIXTURES_DIR=/tmp/vbt-rev node scripts/check-variants.mjs` printed
   `✗ goldens: variant 'ncube-5' has no golden entry in golden-ncube-v1.json; regenerate with:
   node scripts/generate-golden.mjs`, `exit=1`. Covered by the second test in
   [test/check-variants.test.js](test/check-variants.test.js).
3. **`generate-golden.mjs` has no `NCUBE_VARIANTS`, imports `BUILT_IN_VARIANTS`, regeneration is a
   no-op** — pass. `grep -c NCUBE_VARIANTS` → `0`; `grep -c BUILT_IN_VARIANTS` → `2`;
   `node scripts/generate-golden.mjs` exit 0 then `git diff --quiet -- test/fixtures` → 0.
4. **`golden-ncube-v1.json` keys and preservation of `ncube`/`ncube-4`; `golden-v1.json`
   unchanged** — pass. Keys `ncube,ncube-3,ncube-4,ncube-5,ncube-6`; `deepStrictEqual` of
   `ncube` and `ncube-4` against `git show origin/main:test/fixtures/golden-ncube-v1.json` →
   `same`; `git diff --quiet origin/main -- test/fixtures/golden-v1.json` → 0.
5. **`test/golden-ncube.test.js` fails on a missing registered id, passes on the branch** —
   pass. `PRISMICON_CHECK_FIXTURES_DIR=/tmp/vbt-rev node --test test/golden-ncube.test.js` →
   `not ok 1 - every registered non-default variant has a golden entry` with `- 'ncube-5'` in the
   diff, `# fail 1`; real fixture → `# tests 6`, `# fail 0`.
6. **`tsc --noEmit --strict --target es2020 --lib es2020,dom index.d.ts` exits 0;
   `strokeWidth?` present** — pass. `tsc-exit=0` (zero `error TS` lines, tsc 7.0.2);
   `grep -c "readonly strokeWidth?: number" index.d.ts` → `1`.
7. **`npm pack --dry-run` contents; no `bin`; `sideEffects: false`** — pass. Tarball lists
   exactly LICENSE, README.md, index.d.ts, package.json and the ten `src/**` files; nothing under
   `test/`, `scripts/`, `demo/`, `.github/`. `bin= undefined sideEffects= false`.
8. **README `## Adding a variant (maintainers)` placement and keywords** — pass.
   `grep -n "^## \|^### " README.md` → L369 `### Example: a spinning square`, L418
   `## Adding a variant (maintainers)`, L459 `## Derivation spec v1 (frozen)`. Counts:
   `check:variants` 3, `generate-golden.mjs` 3, `fixtureFor` 2, `BuiltInVariantId` 2,
   `Spec-bump` 1.
9. **README `flash` row has `'settling'`; timing columns match evidence** — pass.
   `sed -n '/^| \`flash\` |/p' README.md | grep -c "'settling'"` → `1`; the four d = 3..6 rows
   with paint-ms `0.020/0.049/0.095/0.229` and frame-ms `0.014/0.033/0.079/0.227` each grep to
   `1` and match
   [ncube-motion-frames.txt](../ncube-motion-system/evidence/ncube-motion-frames.txt).
10. **Demo no longer uses `describeParams`/`deriveV1`/`anatomy:`; every hero option mounts at
    `local:3183`** — pass. `grep -c "describeParams\|deriveV1\|anatomy" demo/index.html` → `0`;
    `grep -c "'polyhedron'"` → `0`. Re-driven by the Reviewer: served the repo root with
    `python3 -m http.server 3183`, loaded `/demo/index.html`, selected all 7 options via
    Playwright — each mounted exactly one `#hero svg`, `window.handle.variant` equalled the
    selection, console showed `variant: <id> {…params}` for every id and no `anatomy:` line.
    Reviewer screenshot: [review-demo-registry.png](evidence/review-demo-registry.png);
    Builder's [step-4-2-demo-registry.png](evidence/step-4-2-demo-registry.png) inspected and
    consistent (6-cube selected, hero mounted).
11. **`.github/workflows/ci.yml` triggers/steps; PR `CI` check green** — pass. Content check
    (`pull_request`, `branches: [main]`, `npm ci`, `npm test`, `npm run check:variants`,
    `node-version: 22`, `contents: read`) → `ci-ok`. `scripts/wait-for-checks.sh pr 13` →
    `pass=1 fail=0 pending=0 … RESULT: success`, exit 0. Latest run
    https://github.com/david-perry-software/prismicon/actions/runs/34709700283/job/103596066967
    is `success` on `headSha` = HEAD `cd093ef` (the run recorded on step 5.2, 34709582102, was
    for `1db21a1`; both green).
12. **AGENTS.md `Typecheck`/`Full verification`; `npm run verify` exits 0** — pass. AGENTS.md
    L16 `Typecheck: \`npm run check:variants\` (types group; …)`, L18 `Full verification:
    \`npm run verify\``; `verify-exit=0`.
13. **Complete gate** — pass. `npm ci && npm test` → `# tests 130`, `# pass 130`, `# fail 0`
    (baseline 124, +6 ≥ 3); `check:variants` exit 0; `npm run lint` → `Missing script`
    (no lint configured, unchanged from the plan baseline — §5 gate satisfied as *no lint
    configured*); `git diff --quiet origin/main -- src index.d.ts test/fixtures/golden-v1.json
    test/fixtures/ncube-v1-identities.json scripts/measure-ncube.mjs` → 0;
    `git status --porcelain | wc -l` → `0` before this review was written.

## Plan vs implementation

- Delivered as designed: `scripts/check-variants.mjs` (five ordered checks, stop-on-first-failure,
  `✓`/`✗` lines, `PRISMICON_CHECK_FIXTURES_DIR` override), registry-driven
  `scripts/generate-golden.mjs` via `fixtureFor` in `test/helpers/golden.js`, completeness test,
  `check:variants`/`verify` scripts, `typescript` + `@types/react` devDependencies, README guide
  and follow-ups (a)/(b), (c) verified as already resolved, demo console line, CI workflow,
  AGENTS.md commands. `src/**`, `index.d.ts` and the frozen fixtures are untouched.
- Deviation (benign, documented on step 4.2): the demo was served with `python3 -m http.server`
  — the plan's stated alternative — because `serve`'s clean-URL redirect breaks the relative
  `./square-variant.js` import. Reviewer reproduced the same choice.
- Deviation (benign, beyond the stated scope of follow-up (b)): README rows d = 7..9 also had
  their shaded paint-ms re-synced (`0.752 / 2.223 / 6.696`); these match the same 2026-09-12
  evidence file, so the whole column is now from one run as the README text claims.
- Plan inaccuracy (no code impact): Approach §1 says the pinned `src/index.js` list is "the
  current 19 names"; `src/index.js` exports 18 and `EXPECTED_INDEX_EXPORTS` correctly pins 18.
- Step 5.2's "merge `origin/main`" was a no-op (already an ancestor), recorded on the line.
- No undocumented changes: `git diff origin/main...HEAD --stat` lists only the files named in
  plan.md `### Affected files` plus the feature's own artifacts and `package-lock.json`.

## Roadmap audit

All 15 ticked steps were spot-checked against the codebase and re-run where executable:

- 1.1–1.2: devDependencies present in `package.json`/lockfile; tsc exit 0; `strokeWidth?` grep 1.
- 2.1–2.4: `fixtureFor` exported and throws for unknown ids (`no golden fixture file mapped for
  variant 'zzz'…` path exists at [test/helpers/golden.js](test/helpers/golden.js#L14-L18));
  regeneration idempotent; preservation proof reproduced; completeness test bites (commit
  `ca6be9d` body carries the assertion line as required).
- 3.1–3.5: all five checks green; scratch-fixture failure reproduced; scripts and AGENTS.md
  updated; `test/check-variants.test.js` 2/2.
- 4.1–4.2: README greps pass; demo greps pass; step 4.2 links its evidence file, which exists
  (60588 bytes) and shows the described state.
- 5.1–5.2: workflow content check `ci-ok`; `wait-for-checks.sh pr 13` exit 0; run URL on the line.
- 6.1–6.2: gate reproduced (130/0, check exit 0, no lint script, frozen diff 0, pack clean);
  `isDraft: true`; `git log origin/main..HEAD` shows only this feature's 19 commits.

No falsely ticked boxes; no missing-work steps needed; no repairs made. No `(manual)` or
`(manual, post-ship)` steps exist.

## Findings

Ordered by severity. None above minor.

1. **Minor — README recipe step 2 contradicts the export contract it is gated by.**
   [README.md](README.md#L426-L427) tells maintainers to register the new descriptor "and
   re-export[…] it from `src/index.js`". No built-in descriptor is re-exported from
   [src/index.js](src/index.js) (18 names, none a descriptor — `polyhedron`/`ncube` live only in
   `src/variants/index.js`), and following the instruction would fail
   `EXPECTED_INDEX_EXPORTS` in [scripts/check-variants.mjs](scripts/check-variants.mjs#L24-L43)
   with `src/index.js export list drifted` while widening the public API. The gate catches it,
   so this is docs-only; fix by deleting the clause (built-ins are resolved by id) or, if a
   public re-export is intended, saying the pinned list and `index.d.ts` must be updated too.
2. **Minor — plan text off by one.** [plan.md](plan.md) Approach §1 "the current 19 names" vs the
   actual 18 exports; the script is correct. Cosmetic.
3. **Info — scratch temp dir not cleaned.** [test/check-variants.test.js](test/check-variants.test.js#L32)
   creates a `mkdtempSync` directory per run and never removes it. Negligible size; a
   `rmSync(scratch, { recursive: true })` in a `finally`/`after` would keep `tmpdir()` tidy.
4. **Info — `npm` spawned without `shell` is POSIX-only.** [scripts/check-variants.mjs](scripts/check-variants.mjs#L103)
   `spawnSync('npm', …)` would not resolve `npm.cmd` on Windows. CI runs `ubuntu-latest` and
   the script is maintainer-only, so no impact today.

Security: no new runtime code, no network access in the gate (`tsc` is resolved from
`node_modules/.bin`, no `npx -y`), CI has `permissions: contents: read`, published tarball
unchanged. No secrets in artifacts or screenshots.

## Follow-ups

- Fix README step 2 wording (finding 1) — one-line docs change; could ride along with
  `alternate-visual-variant`, which is the first consumer of the recipe.
- Clean up the scratch fixtures directory in `test/check-variants.test.js` (finding 3).
