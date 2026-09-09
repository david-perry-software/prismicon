```yaml
status: complete
branch: feature/variant-registry-contract
last-updated: 2026-09-09
next-step: ""
initiative: "scalable-icon-variants"
```

## Phase 1: Descriptor and registry contract

- [x] 1.1 Create `src/variants/registry.js` exporting `VARIANT_ID_PATTERN` and `defineVariant(descriptor)`: validate `id` (pattern), `label` and `spec` (non-empty strings), the four function hooks `derive`, `describe`, `renderStatic`, `mount`, reject unknown keys, throw `TypeError` naming the field, return `Object.freeze`d copy; add the module header documenting the reserved `variant` option key and the fallback rule; no import from `core.js` — verify: `node -e "import('./src/variants/registry.js').then(m => console.log(Object.keys(m).sort().join(',')))"` prints `VARIANT_ID_PATTERN,defineVariant` and `grep -c "core.js" src/variants/registry.js` prints `0`
- [x] 1.2 Create `test/variants.test.js` (`node:test` + `node:assert/strict`) covering `defineVariant`: valid descriptor is returned frozen; bad `id`, missing hook, non-function hook, unknown key, non-string `label`/`spec` each throw `TypeError` mentioning the field — verify: `node --test test/variants.test.js` exits 0 with every subtest `ok`
- [x] 1.3 Add `createVariantRegistry(descriptors, { defaultId })` to `src/variants/registry.js`: runs each descriptor through `defineVariant`, rejects duplicate ids and an unregistered `defaultId` (`TypeError`), returns a frozen object with frozen `ids` (registration order), `defaultId`, `has(id)`, `get(id)` (unknown → `RangeError` `Unknown prismicon variant "<id>"; registered: <ids>`), `resolve(key)` (`undefined`/`null` → default, string → `get`, other → `TypeError`); `Map`-backed lookup — verify: `node -e "import('./src/variants/registry.js').then(m => console.log(typeof m.createVariantRegistry))"` prints `function`
- [x] 1.4 Extend `test/variants.test.js` with registry tests: duplicate id rejected, unknown `defaultId` rejected, `ids` order and frozenness, `has`/`get`, `resolve(undefined)`/`resolve(null)` return the default, `resolve('nope')` throws `RangeError` whose message contains `"nope"` and the registered ids, `resolve(42)` throws `TypeError` — verify: `node --test test/variants.test.js` exits 0

## Phase 2: Built-in default variant

- [x] 2.1 Create `src/variants/polyhedron.js` exporting `polyhedron = defineVariant({ id: 'polyhedron', label: 'Polyhedron', spec: SPEC_VERSION, derive: deriveV1, describe: describeParams, renderStatic: renderStaticSVG, mount: mountGlyph })` importing those names from `../core.js` — verify: `node -e "import('./src/variants/polyhedron.js').then(m => console.log(m.polyhedron.id, m.polyhedron.spec, Object.isFrozen(m.polyhedron)))"` prints `polyhedron v1 true`
- [x] 2.2 Create `src/variants/index.js` exporting `DEFAULT_VARIANT_ID = 'polyhedron'`, `BUILT_IN_VARIANTS = createVariantRegistry([polyhedron], { defaultId: DEFAULT_VARIANT_ID })`, `resolveVariant(key, registry = BUILT_IN_VARIANTS)`, and re-exporting `defineVariant`, `createVariantRegistry`, `VARIANT_ID_PATTERN` — verify: `node -e "import('./src/variants/index.js').then(m => console.log(m.resolveVariant().id, m.BUILT_IN_VARIANTS.ids.join(',')))"` prints `polyhedron polyhedron`
- [x] 2.3 Add parity tests to `test/variants.test.js`: for seeds `maya`, `build-bot-7`, `Alice@X.com`, `polyhedron.derive(seed)` deep-equals `deriveV1(seed)` and the `FROZEN` values from `test/derivation-freeze.test.js` (copy the fixture literal; do not modify that file), and `polyhedron.renderStatic(seed, opts)` string-equals `renderStaticSVG(seed, opts)` for `opts` in `{}`, `{ size: 24 }`, `{ kind: 'user' }`, `{ state: 'thinking', dark: true }` — verify: `node --test test/variants.test.js` exits 0
- [x] 2.4 Add a public-surface guard test to `test/variants.test.js`: `Object.keys(await import('../src/index.js')).sort()` deep-equals the sorted list `FINISH_NAMES, PALETTE, SIDE_NAMES, SOLID_NAMES, SPEC_VERSION, STATES, deriveV1, describeParams, mountGlyph, normalizeSeed, renderStaticSVG`, and `import('../src/index.js')` exposes no key containing `variant` (case-insensitive) — verify: `node --test test/variants.test.js` exits 0

## Phase 3: Verification and hand-off

- [x] 3.1 Confirm untouched files: `git diff --quiet origin/main -- src/index.js src/core.js src/react.js index.d.ts README.md demo/index.html package.json package-lock.json test/derivation-freeze.test.js test/prismicon.test.js` — verify: command exits 0 and `git status --porcelain` lists only `src/variants/` and `test/variants.test.js` as additions plus `features/` edits
- [x] 3.2 Run the complete gate (no lint configured — AGENTS.md): `npm test` — verify: exit 0, `# fail 0`, and `# pass` equals 13 plus the number of subtests in `test/variants.test.js`; record the counts in the commit message body against the baseline `13 pass / 0 fail`
- [x] 3.3 Confirm packaging: `npm pack --dry-run 2>&1 | grep -E "src/variants/(registry|polyhedron|index)\.js"` — verify: all three paths listed, and `grep '"sideEffects": false' package.json` still matches
- [x] 3.4 Merge `origin/main` into `feature/variant-registry-contract` (merge, never rebase), rerun `npm test`, push, and set the roadmap header `status: in-review` with `next-step: ""` — verify: `git log --oneline -1 origin/main` is an ancestor of `HEAD` (`git merge-base --is-ancestor origin/main HEAD` exits 0) and `npm test` exits 0
