```yaml
status: in-progress
branch: feature/variant-build-tooling
last-updated: 2026-09-12
next-step: "2.1 Add fixtureFor(id) to test/helpers/golden.js"
initiative: "scalable-icon-variants"
```

## Phase 1: Toolchain and baseline

- [x] 1.1 Add `typescript` and `@types/react` to `devDependencies` (caret ranges) with `npm install --save-dev typescript @types/react`, commit `package.json` + `package-lock.json` — verify: `npm ci && node_modules/.bin/tsc --noEmit --strict --target es2020 --lib es2020,dom index.d.ts` exits 0 with zero `error TS` lines (baseline had one TS7016 for `'react'`).
- [x] 1.2 Confirm the untouched baseline before any script change — verify: `npm test` prints `# tests 124` and `# fail 0`; `npm pack --dry-run` lists no `test/`, `scripts/`, `demo/` files; `grep -c "readonly strokeWidth?: number" index.d.ts` prints `1` (follow-up (c) already resolved — record in plan.md if it differs).

## Phase 2: Registry-driven goldens

- [ ] 2.1 Add `fixtureFor(id)` to `test/helpers/golden.js` (default id → `golden-v1.json`, `ncube*` → `golden-ncube-v1.json`, unknown family → throws naming the id) and export it — verify: `node -e "import('./test/helpers/golden.js').then(m => { console.log(m.fixtureFor('polyhedron'), m.fixtureFor('ncube-5')); try { m.fixtureFor('zzz') } catch (e) { console.log(e.message) } })"` prints the two file names and an error naming `zzz`.
- [ ] 2.2 Rewrite `scripts/generate-golden.mjs` to iterate `BUILT_IN_VARIANTS.ids` (default id → `golden-v1.json` unchanged; other ids grouped by `fixtureFor`), removing `NCUBE_VARIANTS` — verify: `grep -c NCUBE_VARIANTS scripts/generate-golden.mjs` prints `0`; `node scripts/generate-golden.mjs` exits 0 and `node -e "console.log(Object.keys(require('./test/fixtures/golden-ncube-v1.json')).join(','))"` prints `ncube,ncube-3,ncube-4,ncube-5,ncube-6`.
- [ ] 2.3 Prove regeneration preserved existing entries — verify: `git diff --quiet origin/main -- test/fixtures/golden-v1.json` exits 0 and `node -e "const a=require('./test/fixtures/golden-ncube-v1.json'); const b=JSON.parse(require('child_process').execSync('git show origin/main:test/fixtures/golden-ncube-v1.json')); for (const k of ['ncube','ncube-4']) require('assert').deepStrictEqual(a[k], b[k]); console.log('same')"` prints `same`.
- [ ] 2.4 Add a completeness test to `test/golden-ncube.test.js` asserting the fixture's key set equals `BUILT_IN_VARIANTS.ids` without `DEFAULT_VARIANT_ID`; prove it bites by running it once against a scratch copy of the fixture with `ncube-5` removed — verify: the scratch run reports a failure naming `ncube-5` (paste the assertion line into the commit message), then `node --test test/golden-ncube.test.js` prints `# fail 0` on the real fixture.

## Phase 3: Check script

- [ ] 3.1 Create `scripts/check-variants.mjs` with the `contract` and `exports` checks (validateVariant over every `BUILT_IN_VARIANTS` id, `listVariants` parity, pinned `src/index.js` and `src/react.js` export lists, `package.json` `exports`/`files`/`sideEffects`/no-`bin` assertions) and `✓`/`✗` reporting with non-zero exit on failure — verify: `node scripts/check-variants.mjs` exits 0 and prints `✓ contract` and `✓ exports`.
- [ ] 3.2 Add the `types` check (spawn `node_modules/.bin/tsc --noEmit --strict --target es2020 --lib es2020,dom index.d.ts`) and the `pack` check (`npm pack --dry-run --json`, file list equals the expected set, nothing from `test/`, `scripts/`, `demo/`, `.github/`) — verify: `node scripts/check-variants.mjs` prints `✓ types` and `✓ pack` and exits 0; `node_modules/.bin/tsc --noEmit --strict --target es2020 --lib es2020,dom index.d.ts; echo "exit=$?"` prints `exit=0` (the code the check keys on).
- [ ] 3.3 Add the `goldens` check: for `DEFAULT_VARIANT_ID` and every other registered id, `captureGolden({ variant })` deep-equals the entry in `fixtureFor(id)` (fixtures dir from `PRISMICON_CHECK_FIXTURES_DIR`, default `test/fixtures`); a missing entry fails with `regenerate with: node scripts/generate-golden.mjs` — verify: `node scripts/check-variants.mjs` prints `✓ goldens` and exits 0; `mkdir -p /tmp/vbt && node -e "const g=require('./test/fixtures/golden-ncube-v1.json'); delete g['ncube-5']; require('fs').writeFileSync('/tmp/vbt/golden-ncube-v1.json', JSON.stringify(g)); require('fs').copyFileSync('test/fixtures/golden-v1.json','/tmp/vbt/golden-v1.json')" && PRISMICON_CHECK_FIXTURES_DIR=/tmp/vbt node scripts/check-variants.mjs; echo "exit=$?"` prints a `✗ goldens` line naming `ncube-5` and `generate-golden.mjs` and `exit=1`.
- [ ] 3.4 Add `package.json` scripts `check:variants` (`node scripts/check-variants.mjs`) and `verify` (`npm test && npm run check:variants`); update `AGENTS.md` `### Commands` (`Typecheck: npm run check:variants` (types group), `Full verification: npm run verify`) — verify: `npm run check:variants` exits 0; `npm run verify` exits 0; `grep -c "check:variants" AGENTS.md` ≥ 1.
- [ ] 3.5 Add `test/check-variants.test.js` (spawns the script: exit 0 with one `✓` per check name; with `PRISMICON_CHECK_FIXTURES_DIR` at a temp fixtures dir missing `ncube-5`, non-zero exit and output naming `ncube-5` and `generate-golden.mjs`) — verify: `node --test test/check-variants.test.js` prints `# fail 0` with ≥ 2 tests; `npm test` prints `# fail 0` and `# tests` ≥ 127.

## Phase 4: Docs and demo

- [ ] 4.1 README: add `## Adding a variant (maintainers)` between `### Example: a spinning square` and `## Derivation spec v1 (frozen)` (recipe, what each check verifies, spec-bump rule, CI); append the `'settling'` clause to the `flash` row; replace the support table's shaded paint-ms column with `0.020 / 0.049 / 0.095 / 0.229` and frame-ms with `0.014 / 0.033 / 0.079 / 0.227` citing `features/2026/09/ncube-motion-system/evidence/ncube-motion-frames.txt` — verify: `grep -n "^## \|^### " README.md` shows the new heading immediately before `## Derivation spec v1 (frozen)`; `grep -c "check:variants\|generate-golden.mjs\|fixtureFor\|BuiltInVariantId" README.md` ≥ 4; `sed -n '/^| `flash` |/p' README.md | grep -c "'settling'"` prints `1`; `grep -c "| 6 | 64 | 192 | 240 | 25890 / 4479 | 7.29 | 0.229 | 0.227 | yes |" README.md` prints `1`.
- [ ] 4.2 Demo: remove the `describeParams`/`deriveV1` imports and the `anatomy:` console line from `demo/index.html`, logging `variant:` + `handle.params` instead; serve the repo root on the slug port and drive the hero `<select>` through every option, capturing `evidence/step-4-2-demo-registry.png` — verify: `grep -c "describeParams\|deriveV1\|anatomy" demo/index.html` prints `0`; `local:3183` — `npx -y serve -l 3183 .` then `http://localhost:3183/demo/index.html`: each of the six options mounts an `<svg>` and the console shows `variant: <selected id>`; screenshot linked from this step.

## Phase 5: CI

- [ ] 5.1 Add `.github/workflows/ci.yml` (`name: CI`; on `pull_request` and `push` to `main`; `permissions: contents: read`; `ubuntu-latest`; `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22` and `cache: npm`; `npm ci`, `npm test`, `npm run check:variants`) — verify: `node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); for (const s of ['pull_request','npm ci','npm test','npm run check:variants','node-version: 22','contents: read']) if(!y.includes(s)) throw new Error(s); console.log('ok')"` prints `ok`.
- [ ] 5.2 Merge `origin/main`, push, and confirm the workflow runs green on this PR — verify: `preview: GitHub Actions is the only executor of the workflow` — `scripts/wait-for-checks.sh pr <n>` exits 0 with a `CI` check reported `success`; record the run URL on this line.

## Phase 6: Final gate

- [ ] 6.1 Run the complete gate (policy §5, no lint configured) and record results in plan.md `## Research` — verify: `npm ci && npm test` prints `# fail 0` and `# tests` ≥ 127; `npm run check:variants` exits 0; `npm run lint` still prints `Missing script` (record otherwise); `git diff --quiet origin/main -- src index.d.ts test/fixtures/golden-v1.json test/fixtures/ncube-v1-identities.json scripts/measure-ncube.mjs` exits 0; `npm pack --dry-run` lists no `test/`, `scripts/`, `demo/`, `.github/` entries.
- [ ] 6.2 Integrate `origin/main`, set `status: in-review`, push — verify: `git status --porcelain` empty; `git log origin/main..HEAD --oneline` shows only this feature's commits; `gh pr view <n> --json isDraft -q .isDraft` prints `true`.
