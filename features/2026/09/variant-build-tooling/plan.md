# Variant build tooling: maintainer check gate, registry-driven goldens, docs, demo and CI

## Problem

prismicon now ships two built-in variant families (`polyhedron`, `ncube` + `ncube-3 … ncube-6`)
and a consumer authoring surface (`validateVariant`, `createPrismicon`), but the repository has
no repeatable way to add the *next* variant safely. Today:

- `scripts/generate-golden.mjs` hardcodes `NCUBE_VARIANTS = ['ncube', 'ncube-4']`
  ([scripts/generate-golden.mjs](../../../../scripts/generate-golden.mjs#L11)), so a new
  registered id gets no golden unless a maintainer remembers to edit the list; the freeze
  is only as complete as the list.
- The only automated gate is `npm test` ([package.json](../../../../package.json#L47)). The
  `index.d.ts` compile check, `npm pack` contents check and golden-freshness check exist only
  as one-off commands in earlier plans' acceptance checklists (e.g.
  [custom-variant-authoring/plan.md](../custom-variant-authoring/plan.md)) and are re-typed by
  hand every delivery.
- There is no CI: `.github/` contains only `agento.json` (verified with `ls -la .github`), so
  a PR can be opened green-looking with a red `npm test`.
- README has no maintainer guide for adding a variant; three reviews left cosmetic
  follow-ups ([custom-variant-authoring/review.md](../custom-variant-authoring/review.md#L84),
  [ncube-geometry-family/review.md](../ncube-geometry-family/review.md#L164-L166),
  [ncube-motion-system/review.md](../ncube-motion-system/review.md#L94-L96)) that nobody owns.
- `demo/index.html` logs `describeParams(deriveV1('demo-agent'))` for every hero variant
  ([demo/index.html](../../../../demo/index.html#L79)) — the polyhedron-only derivation — so
  the console "anatomy" line is wrong for every n-cube id.

This feature is the `variant-build-tooling` member of the **scalable-icon-variants**
initiative — see the `### variant-build-tooling` block in
[initiatives/2026/09/scalable-icon-variants/breakdown.md](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
(Brief: "Include build tooling and a durable system for adding and managing many future
variants."; Requires `custom-variant-authoring`, complete). It is the last blocker of
`alternate-visual-variant`, which must be able to add a variant by following a documented,
machine-checked recipe.

User-visible effect: maintainers get one command, `npm run check:variants`, that fails when any
built-in variant breaks the descriptor contract, when a registered variant lacks a golden or its
golden is stale, when `index.d.ts` no longer compiles, or when the published tarball drifts; CI
runs it on every PR; README documents how to add a variant; the demo derives everything from the
registry. Package consumers see no runtime change.

## Decisions

Clarifying questions were asked and answered in the previous Planner pass; answers are recorded
verbatim.

1. **Tooling shape?** — **Maintainer check script** only — an `npm run check:variants` entry
   that runs `validateVariant` over every built-in variant, verifies package exports,
   `index.d.ts` typecheck (`tsc --noEmit`), `npm pack` contents, and golden freshness. No
   consumer CLI/bin, no scaffold generator.
2. **Publishing boundary?** — **Maintainer-only** — everything under `scripts/` and `test/`;
   the package stays zero-build, side-effect-free, no `bin`.
3. **Golden management?** — **Registry-driven capture** — one fixture entry per registered
   variant (no hardcoded `NCUBE_VARIANTS` list in `scripts/generate-golden.mjs`), with a
   freshness check in the gate. No consumer golden recipe/export.
4. **Docs & follow-ups?** — "Adding a variant" maintainer guide as a **README section**;
   **include the 3 open review follow-ups** in scope: (a) README `flash` row lacks a
   `'settling'` clause, (b) README n-cube paint-ms / frame-ms columns out of sync with
   `features/2026/09/ncube-motion-system/evidence/*.txt`, (c) `strokeWidth?` missing from
   `NcubeParams` in `index.d.ts`.
5. **Demo & CI?** — **Registry-driven demo** (variant list from `listVariants()`, drop the
   polyhedron-only console helper; no authoring playground) and **add a GitHub Actions CI
   workflow** running `npm test` plus the new check on PRs (none exists today).

## Research

Skills consulted: modern-javascript-patterns (`.agents/skills/modern-javascript-patterns/SKILL.md`
— ESM modules, `const` by default, array methods over loops, async/await, pure functions; applied
to the check script and golden-capture refactor design below). `vercel-react-best-practices` was
not loaded: no React code changes are in scope.

### Existing surfaces (evidence)

- Registry: `createVariantRegistry` returns a frozen `{ ids, defaultId, has, get, resolve }`
  ([src/variants/registry.js](../../../../src/variants/registry.js#L120-L158));
  `BUILT_IN_VARIANTS = createVariantRegistry([polyhedron, ...ncubeVariants], { defaultId: 'polyhedron' })`
  and `listVariants(registry)` → frozen `{ id, label, spec }[]`
  ([src/variants/index.js](../../../../src/variants/index.js#L10-L34)). Registered ids today:
  `polyhedron, ncube, ncube-3, ncube-4, ncube-5, ncube-6` (README `## Variants` listing and
  `test/authoring.test.js` `builtInIds`).
- `validateVariant(descriptor, { seeds?, size?, states? })` — shape check, SSR probe, determinism
  probe; throws `TypeError` naming id/probe/hook; returns the frozen descriptor
  ([src/variants/validate.js](../../../../src/variants/validate.js#L203-L226)). It already runs
  over every built-in in `test/authoring.test.js` ("accepts every built-in descriptor").
- Public exports: `src/index.js` exports 11 core names + 6 variant names + `createPrismicon`
  (18 total) ([src/index.js](../../../../src/index.js)); `package.json` `exports` maps `.` and `./react`,
  `files` = `src`, `index.d.ts`, `README.md`, `LICENSE`, `sideEffects: false`, no `bin`
  ([package.json](../../../../package.json#L6-L25)).
- Golden capture: `captureGolden({ variant })` in
  [test/helpers/golden.js](../../../../test/helpers/golden.js#L125-L134) is already
  variant-parameterised; `scripts/generate-golden.mjs` writes `golden-v1.json` (default variant)
  and `golden-ncube-v1.json` keyed by the hardcoded `['ncube', 'ncube-4']`
  ([scripts/generate-golden.mjs](../../../../scripts/generate-golden.mjs#L9-L28)). Current
  fixture keys: `['ncube', 'ncube-4']` (checked with `node -e`), so `ncube-3`, `ncube-5`,
  `ncube-6` have no golden today. `test/golden-ncube.test.js` iterates whatever keys the
  fixture has ([test/golden-ncube.test.js](../../../../test/golden-ncube.test.js#L12)) — it
  cannot detect a *missing* entry, only a stale one.
- `scripts/measure-ncube.mjs` is n-cube-specific benchmarking (evidence in
  `features/2026/09/ncube-geometry-family/evidence/ncube-bounds.txt` and
  `features/2026/09/ncube-motion-system/evidence/ncube-motion-frames.txt`); not touched.
- Demo: the hero `<select>` is already populated from `listVariants()`
  ([demo/index.html](../../../../demo/index.html#L82-L89)), and the Dimensions / Lifecycle rows
  filter `listVariants()` by the `ncube-` prefix
  ([demo/index.html](../../../../demo/index.html#L123)). The non-registry piece is the
  `describeParams(deriveV1('demo-agent'))` console line and its `describeParams`/`deriveV1`
  imports ([demo/index.html](../../../../demo/index.html#L64), [L79](../../../../demo/index.html#L79)).
  `window.handle` is documented by the intro text (`handle.setState('done')`,
  [demo/index.html](../../../../demo/index.html#L22-L23)) and stays.
- README headings (`grep -n "^## \|^### " README.md`): `## Variants` (L108) → `### N-cube
  family` (L148) → `## Custom variants` (L231) with `### The descriptor contract` (L242),
  `### Validating a variant` (L271), `### createPrismicon` (L306), `### React:
  PrismiconProvider` (L343), `### Example: a spinning square` (L368) → `## Derivation spec v1
  (frozen)` (L417) → `## Performance` (L429) → `## License` (L436).
- CI helper: `scripts/wait-for-checks.sh pr <n>` exists for bounded check polling
  ([scripts/wait-for-checks.sh](../../../../scripts/wait-for-checks.sh#L7-L9)).

### Follow-up status (Decision 4)

- (a) README hook table `flash` row ([README.md](../../../../README.md#L261)) says "On each
  state transition." with no mention that `validateVariant` also calls it with `'settling'`
  (`PROBE_STATES`, [src/variants/validate.js](../../../../src/variants/validate.js#L27-L29)) —
  **open**.
- (b) README support table ([README.md](../../../../README.md#L218-L225)) shows shaded
  paint-ms `0.041 / 0.059 / 0.135 / 0.370` and frame-ms `0.014 / 0.032 / 0.081 / 0.236` for
  d = 3..6. The committed evidence shows shaded paint-ms `0.020 / 0.049 / 0.095 / 0.229`
  (`ncube-motion-frames.txt`, 2026-09-12 run; `ncube-bounds.txt` 2026-09-11 run:
  `0.020 / 0.052 / 0.099 / 0.278`) and frame-ms `0.014 / 0.033 / 0.079 / 0.227` — **open**;
  sync to the 2026-09-12 file, which contains both tables from one run.
- (c) `strokeWidth?: number` **already exists** in `NcubeParams`
  ([index.d.ts](../../../../index.d.ts#L56-L57), added by `ncube-motion-system`). Nothing to
  change; the plan verifies it with a grep and closes the follow-up as already resolved.

### Baselines (2026-09-12, Node v22.22.3, npm 10.9.8)

- **Lint baseline (policy §5):** AGENTS.md declares `Lint: none` and `Typecheck: none`;
  `npm run lint` → `npm error Missing script: "lint"`. There is no lint command and therefore
  no findings to compare — recorded as *no lint configured*. Overlap decision: not applicable;
  the complete gate is `npm test` plus the checks this feature adds (`npm run check:variants`),
  and the Builder must re-run `npm run lint` at the end to confirm the script is still absent
  (or, if one is introduced by a concurrent delivery, record its result).
- **Tests:** `npm ci && npm test` → `# tests 124`, `# suites 9`, `# pass 124`, `# fail 0`.
- **Types:** `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom
  --types "" index.d.ts` → exactly one error, the pre-existing
  `index.d.ts(244,63): error TS7016: Could not find a declaration file for module 'react'`
  (no `@types/react`, no `typescript` in devDependencies, no `tsconfig.json`).
- **Pack:** `npm pack --dry-run` lists LICENSE, README.md, index.d.ts, package.json and the ten
  `src/**` files; nothing under `test/`, `scripts/`, `demo/`.
- **Goldens:** `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures` → 0
  (fresh for the two captured ids).
- **Concurrent delivery:** `gh pr list --state open --json number,headRefName` → `[]`. No
  overlap to record.

### Final gate (step 6.1, 2026-09-12, Node v22.22.3, npm 10.9.8, HEAD 1db21a1)

- **Tests:** `npm ci && npm test` → `# tests 130`, `# suites 9`, `# pass 130`, `# fail 0`
  (baseline 124; +6 from `test/check-variants.test.js` and the golden completeness test).
- **Check gate:** `npm run check:variants` → `✓ contract`, `✓ exports`, `✓ types`, `✓ pack`,
  `✓ goldens`, exit 0.
- **Lint:** `npm run lint` → `npm error Missing script: "lint"` — unchanged, no lint configured.
- **Frozen surfaces:** `git diff --quiet origin/main -- src index.d.ts
  test/fixtures/golden-v1.json test/fixtures/ncube-v1-identities.json scripts/measure-ncube.mjs`
  → exit 0 (no runtime, type, or frozen-fixture change).
- **Pack:** `npm pack --dry-run` lists exactly `index.d.ts`, `LICENSE`, `package.json`,
  `README.md` and the ten `src/**` files; zero entries under `test/`, `scripts/`, `demo/`,
  `.github/`.
- **CI:** workflow `CI` / job `verify` SUCCESS on PR #13 —
  https://github.com/david-perry-software/prismicon/actions/runs/34709582102/job/103595748820

## Approach

All changes are maintainer-side (`scripts/`, `test/`, `.github/workflows/`, `package.json`
`scripts`/`devDependencies`, README, demo, one `index.d.ts` no-op verification). `src/**` and
`test/fixtures/*-identities.json` / `golden-v1.json` are not modified; `golden-ncube-v1.json`
only *gains* entries.

### 1. `scripts/check-variants.mjs` + `npm run check:variants`

A single ESM Node script (no dependencies beyond `node:*` and the repo) that runs, in order,
and exits non-zero on the first failing group with a one-line `✗ <check>: <reason>` and
`✓ <check>` for passes:

1. **Contract** — `for (const id of BUILT_IN_VARIANTS.ids) validateVariant(BUILT_IN_VARIANTS.get(id))`;
   also asserts `listVariants()` ids equal `BUILT_IN_VARIANTS.ids`, every `id` matches
   `VARIANT_ID_PATTERN`, `label`/`spec` non-empty, and `DEFAULT_VARIANT_ID` is registered.
2. **Exports** — `Object.keys(await import('../src/index.js'))` equals a pinned sorted list
   (the current 18 names); `Object.keys(await import('../src/react.js'))` equals
   `['Prismicon', 'PrismiconProvider', 'default']`; `package.json` `exports` has exactly `.`
   and `./react`, each with `types: ./index.d.ts` and an existing `default` file; `files`
   contains `src`, `index.d.ts`, `README.md`, `LICENSE`; `sideEffects === false`; no `bin`.
3. **Types** — spawns `tsc --noEmit --strict --target es2020 --lib es2020,dom index.d.ts`
   through the local `node_modules/.bin/tsc`; must exit 0. To make that pass deterministically
   and offline, `typescript` and `@types/react` are added to `devDependencies` (pinned caret
   ranges), which removes the pre-existing TS7016 rather than tolerating it. This is the only
   change outside `scripts/`/`test/`/docs and keeps the published package zero-build
   (devDependencies are not installed by consumers).
4. **Pack** — runs `npm pack --dry-run --json`, asserts the file list equals the expected set
   derived from `files` (every entry is under `src/` or is one of `index.d.ts`, `README.md`,
   `LICENSE`, `package.json`) and contains nothing from `test/`, `scripts/`, `demo/`,
   `.github/`.
5. **Goldens** — for the default variant and **every** registered id: `captureGolden({ variant })`
   and deep-compare against the committed fixtures (`golden-v1.json` for the default,
   `golden-ncube-v1.json[id]` for each n-cube id, and — generically — `golden-<family>.json`
   resolved by a small `fixtureFor(id)` helper exported from `test/helpers/golden.js`); a
   registered id with **no** fixture entry fails with `regenerate with: node
   scripts/generate-golden.mjs`. The comparison reuses the existing capture, so the check is
   equivalent to the golden tests plus a completeness assertion.

`package.json` gains `"check:variants": "node scripts/check-variants.mjs"` and a convenience
`"verify": "npm test && npm run check:variants"`; `test` is unchanged. The script is
structured as an array of `{ name, run }` checks iterated with `for await`, each `run` a pure
async function returning `void` or throwing — small functions, `const`, template literals,
array methods (skill guidance).

### 2. Registry-driven golden capture (`scripts/generate-golden.mjs`, `test/helpers/golden.js`)

- Delete `NCUBE_VARIANTS`. Import `BUILT_IN_VARIANTS` / `DEFAULT_VARIANT_ID` and iterate
  `BUILT_IN_VARIANTS.ids`: the default id writes `golden-v1.json` exactly as today (byte-identical
  output — verified by `git diff --quiet -- test/fixtures/golden-v1.json` after regeneration);
  every other id is grouped by family via `fixtureFor(id)` (`ncube*` → `golden-ncube-v1.json`)
  and written as one entry per id, keys sorted in registry order. Result: `golden-ncube-v1.json`
  keys become `ncube, ncube-3, ncube-4, ncube-5, ncube-6`; the existing `ncube` and `ncube-4`
  entries must remain byte-identical (checked with a `node -e` JSON comparison against
  `origin/main`'s fixture before commit).
- `test/golden-ncube.test.js` gains one completeness test: the fixture's key set equals
  `BUILT_IN_VARIANTS.ids` minus the default — so a future registered id without a golden fails
  `npm test`, not just the check script.
- `fixtureFor(id)` is the single place a future family adds its fixture-file mapping; the
  README guide names it.

### 3. README

- New `## Adding a variant (maintainers)` section inserted between `## Custom variants`'
  last subsection (`### Example: a spinning square`) and `## Derivation spec v1 (frozen)`.
  Contents: the recipe (write `src/variants/<id>.js` with `defineVariant`; register it in
  `src/variants/index.js` `BUILT_IN_VARIANTS`; add its fixture mapping in `fixtureFor` if it
  is a new family; `node scripts/generate-golden.mjs`; add the id to `BuiltInVariantId` in
  `index.d.ts`; document in `## Variants`; run `npm run check:variants`), what each check in
  the gate verifies and its failure message, the spec-bump rule (`spec` must change whenever
  identities change and a new golden file is created rather than overwriting), and the CI
  workflow that runs it.
- Follow-up (a): append to the `flash` row: "`validateVariant` also calls it with the internal
  `'settling'` state, so return `null` (or a valid object) for unknown states."
- Follow-up (b): replace the shaded paint-ms column with `0.020 / 0.049 / 0.095 / 0.229` and
  the frame-ms column with `0.014 / 0.033 / 0.079 / 0.227` (from
  `features/2026/09/ncube-motion-system/evidence/ncube-motion-frames.txt`, one run on
  2026-09-12) and cite that file as the source of both columns.
- Follow-up (c): no README change; verification only (Approach §5).

### 4. Demo (`demo/index.html`)

- Remove the `describeParams` and `deriveV1` imports and the `console.log('variant:', …,
  'anatomy:', describeParams(deriveV1('demo-agent')))` line; replace with
  `console.log('variant:', handle.variant, handle.params)` so the console reflects the resolved
  variant for every id. `window.handle` stays (documented by the intro text).
- Nothing else in the page hardcodes variant ids: the hero select and both n-cube rows are
  already derived from `listVariants()`; the `startsWith('ncube-')` family filter on
  [demo/index.html](../../../../demo/index.html#L123) stays (it selects a family from the
  registry, not a fixed id list). After the change `grep -c "'polyhedron'" demo/index.html`
  prints `0`.
- Verified in a browser at `local:3183` (`agento.mjs ports variant-build-tooling` → WEB_PORT
  3183) by serving the repo root with `npx -y serve -l 3183 .` (or `python3 -m http.server
  3183`), loading `/demo/index.html`, switching the hero select through every option, and
  capturing `evidence/step-4-2-demo-registry.png`; the console must show a `variant:` line
  whose id equals the selected option and no `anatomy:` line.

### 5. `index.d.ts` (verification only)

`grep -c "readonly strokeWidth?: number" index.d.ts` → `1`; the tsc check in §1 covers the
declaration. Roadmap records follow-up (c) as already resolved.

### 6. CI (`.github/workflows/ci.yml`)

One workflow, `CI`, on `pull_request` (all branches) and `push` to `main`; a single job on
`ubuntu-latest` with `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: 22`,
`cache: npm`), `npm ci`, `npm test`, `npm run check:variants`. `permissions: contents: read`.
Verified by pushing the branch and polling `scripts/wait-for-checks.sh pr <n>` until the run is
green; the first run's URL is recorded on the step.

### Tests

- `test/check-variants.test.js` (new): spawns `node scripts/check-variants.mjs` with
  `execFileSync` and asserts exit 0 and one `✓` line per check name; then, with an
  environment override `PRISMICON_CHECK_FIXTURES_DIR` pointing at a temp dir holding a
  `golden-ncube-v1.json` missing `ncube-5`, asserts non-zero exit and a message naming
  `ncube-5` and `generate-golden.mjs` (proves the completeness check bites). The script reads
  the fixtures dir from that env var with the default `test/fixtures`.
- `test/golden-ncube.test.js`: completeness test (Approach §2).
- Existing 124 tests unchanged.

### Affected files

New: `scripts/check-variants.mjs`, `test/check-variants.test.js`, `.github/workflows/ci.yml`,
`features/2026/09/variant-build-tooling/evidence/*`.
Modified: `scripts/generate-golden.mjs`, `test/helpers/golden.js` (add `fixtureFor`),
`test/golden-ncube.test.js`, `test/fixtures/golden-ncube-v1.json` (three new entries),
`package.json` (`scripts.check:variants`, `scripts.verify`, `devDependencies.typescript`,
`devDependencies.@types/react`), `package-lock.json`, `README.md`, `demo/index.html`,
`AGENTS.md` (`Typecheck`/`Full verification` lines point at the new command).
Not touched: `src/**`, `index.d.ts`, `test/fixtures/golden-v1.json`,
`test/fixtures/ncube-v1-identities.json`, `scripts/measure-ncube.mjs`.

## Risks

- **Regenerating goldens changes existing entries.** Mitigation: the roadmap compares the
  `ncube` and `ncube-4` objects and the whole `golden-v1.json` byte-for-byte against
  `origin/main` after regeneration before committing; any difference is a hard stop.
- **`tsc` availability / lockfile churn.** Adding `typescript` + `@types/react` touches
  `package-lock.json`. Mitigation: pin caret ranges, run `npm ci` from the lockfile in CI, and
  keep the check script pointing at `node_modules/.bin/tsc` (no `npx -y` network fetch).
  Documented here because the user's Decision 2 boundary ("scripts/ and test/") did not
  foresee devDependencies; the package's published surface is unchanged (`npm pack` check).
- **`npm pack --dry-run --json` output shape differs across npm versions.** Mitigation: the
  check tolerates both the array and the `[{ files: [...] }]` shapes and is pinned by the
  Node 22 / npm 10 used in CI (`setup-node@v4` with `node-version: 22`).
- **Check script duplicates `npm test`.** The golden comparison is intentionally the same
  capture; the script's value is the completeness assertion plus exports/types/pack in one
  command. Mitigation: `check:variants` reuses `captureGolden` and asserts, so no second
  source of truth.
- **CI cannot be verified locally.** The workflow is verified against the deployed platform
  (GitHub Actions) by pushing the branch and polling; this is `preview: GitHub Actions is the
  only executor of the workflow` per policy §2 — the agent performs it, it is not `(manual)`.
- **Demo console output**: dropping the `anatomy:` line removes the only human-readable
  description in the console. Mitigation: log `handle.params`, which includes `dimension`
  for n-cubes and the polyhedron fields for the default; the aria-label already carries the
  description text.
- **Concurrent delivery.** No open PRs at planning time. The Builder still merges
  `origin/main` before every push (policy §7). `alternate-visual-variant` cannot start
  until this ships (hard `Requires`).

## Out of scope

- A consumer-facing CLI, `bin` entry, scaffold generator or authoring playground (Decision 1).
- Publishing anything under `scripts/` or `test/`; a consumer golden recipe (Decisions 2–3).
- Adding a lint or formatter (AGENTS.md declares none; introducing one is a separate decision).
- New variants, `NCUBE_MAX_DIMENSION`, spec changes, `src/**` or `index.d.ts` edits beyond
  verification (follow-up (c) is already resolved).
- A release/publish workflow or `checks.releaseWorkflow` configuration in `.github/agento.json`.
- Performance-budget or accessibility-quality probes beyond the existing `validateVariant`.

## Acceptance checklist

- [ ] `npm run check:variants` exits 0 on the branch and prints one `✓` line for each of
  `contract`, `exports`, `types`, `pack`, `goldens` — verified by running it and by
  `test/check-variants.test.js`.
- [ ] With `PRISMICON_CHECK_FIXTURES_DIR` pointing at fixtures lacking `ncube-5`, the script
  exits non-zero and its output names `ncube-5` and `generate-golden.mjs` — verified by
  `node --test test/check-variants.test.js`.
- [ ] `scripts/generate-golden.mjs` contains no `NCUBE_VARIANTS` and imports
  `BUILT_IN_VARIANTS` (`grep -c NCUBE_VARIANTS scripts/generate-golden.mjs` → `0`;
  `grep -c BUILT_IN_VARIANTS scripts/generate-golden.mjs` ≥ 1); after `node
  scripts/generate-golden.mjs`, `git diff --quiet -- test/fixtures` exits 0.
- [ ] `test/fixtures/golden-ncube-v1.json` keys equal `['ncube','ncube-3','ncube-4','ncube-5','ncube-6']`
  and the `ncube` and `ncube-4` entries deep-equal `origin/main`'s; `test/fixtures/golden-v1.json`
  has no diff from `origin/main` — verified by `node -e` comparison against `git show
  origin/main:test/fixtures/golden-ncube-v1.json`.
- [ ] `test/golden-ncube.test.js` fails when a registered non-default id has no fixture entry
  (verified once by temporarily deleting a key in a scratch copy) and passes on the branch.
- [ ] `node_modules/.bin/tsc --noEmit --strict --target es2020 --lib es2020,dom index.d.ts`
  exits 0 (zero `error TS` lines) after `npm ci`; `grep -c "readonly strokeWidth?: number"
  index.d.ts` → `1`.
- [ ] `npm pack --dry-run` lists exactly LICENSE, README.md, index.d.ts, package.json and
  `src/**`; nothing under `test/`, `scripts/`, `demo/`, `.github/`; `package.json` has no `bin`
  and `sideEffects: false`.
- [ ] README has `## Adding a variant (maintainers)` between `### Example: a spinning square`
  and `## Derivation spec v1 (frozen)` (`grep -n "^## \|^### " README.md` order) mentioning
  `check:variants`, `generate-golden.mjs`, `fixtureFor`, `BuiltInVariantId` and the spec-bump
  rule (`grep -c` each ≥ 1).
- [ ] README `flash` row contains `'settling'`; the support table's shaded paint-ms column
  reads `0.020`, `0.049`, `0.095`, `0.229` and frame-ms `0.014`, `0.033`, `0.079`, `0.227`,
  matching `features/2026/09/ncube-motion-system/evidence/ncube-motion-frames.txt` — verified
  by `grep`.
- [ ] `demo/index.html` no longer imports `describeParams`/`deriveV1` nor logs `anatomy:`
  (`grep -c "describeParams\|deriveV1\|anatomy" demo/index.html` → `0`); served at
  `local:3183`, every hero `<select>` option mounts and the console logs `variant: <id>`;
  screenshot at `evidence/step-4-2-demo-registry.png`.
- [ ] `.github/workflows/ci.yml` exists, triggers on `pull_request` and `push` to `main`, runs
  `npm ci`, `npm test`, `npm run check:variants` on Node 22, and the PR's `CI` check is green
  (`scripts/wait-for-checks.sh pr <n>` exits 0; run URL recorded on roadmap step 5.2).
- [ ] `AGENTS.md` `### Commands` lists `Typecheck: npm run check:variants` (types group) and
  `Full verification: npm run verify`; `npm run verify` exits 0.
- [ ] Complete gate (policy §5, no lint configured): `npm ci && npm test` prints `# fail 0` with
  `# tests` ≥ 127 (124 baseline + ≥ 3 new); `npm run check:variants` exits 0; `npm run lint`
  still reports `Missing script` (or its result is recorded if a script has appeared);
  `git diff --quiet origin/main -- src index.d.ts test/fixtures/golden-v1.json
  test/fixtures/ncube-v1-identities.json scripts/measure-ncube.mjs` exits 0; `git status
  --porcelain` empty after the final commit.
