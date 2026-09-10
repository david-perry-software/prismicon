```yaml
status: in-progress
branch: feature/react-variant-selection
last-updated: 2026-09-09
next-step: "1.2 add the focused React variant regression suite"
initiative: "scalable-icon-variants"
```

## Phase 1: Baseline and failing tests

- [x] 1.1 Confirm the recorded baseline on this branch before touching any file — verify: `npm ci && npm test 2>&1 | grep -E "^# (tests|pass|fail)"` prints `# tests 52`, `# pass 52`, `# fail 0` and `git diff --quiet origin/main -- src index.d.ts README.md` exits 0
- [ ] 1.2 Add `test/react-variant.test.js` with a self-contained JSDOM harness (mocked `matchMedia`, counted `requestAnimationFrame`, no `IntersectionObserver`, globals restored `afterEach`, `IS_REACT_ACT_ENVIRONMENT` set around `act`) and the eight cases from plan.md `## Approach` — SSR parity, SSR `RangeError`/`TypeError`, client mount with explicit variant, client render-time throw via `createRoot(container, { onUncaughtError })`, variant change remounts preserving `state` then `state` change keeps the node, invalid update reported with no second glyph, `hydrateRoot` over `renderToString` with `onRecoverableError`, React entry exports exactly `['Prismicon', 'default']` — and commit it **before** any `src/` change — verify: `node --test test/react-variant.test.js; echo "exit=$?"` prints `exit=1` with the SSR-error, render-time-throw, variant-change-remount, and invalid-update cases reported `not ok` while the parity, hydration, and entry-surface cases pass; `git diff --quiet origin/main -- src` exits 0

## Phase 2: Implementation

- [ ] 2.1 Update `src/react.js`: import `resolveVariant` from `./variants/index.js`; destructure `variant` (no default); call `resolveVariant(variant)` as the first statement after destructuring so unknown ids throw during render; pass `variant` to `renderStaticSVG` for `initialMarkup` and to `mountGlyph` in the mount effect; add `variant` to the mount-effect deps `[seed, size, kind, dark, variant]`; leave the `[state]` effect and the exports unchanged — verify: `node --test test/react-variant.test.js 2>&1 | grep -E "^# (tests|fail)"` prints `# tests 8` and `# fail 0`; `grep -c "resolveVariant" src/react.js` prints `2`; `grep -c "variant" src/react.js` ≥ 5; `npm test 2>&1 | grep -E "^# fail"` prints `# fail 0`
- [ ] 2.2 Add `variant?: string` to `PrismiconProps` in `index.d.ts` with JSDoc ("Variant id. Omit to use the default variant. Unknown ids throw RangeError during render.") — verify: `grep -c "variant?: string" index.d.ts` prints `2` and `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts 2>&1 | grep -cE "error TS"` prints `1` and that single line names `'react'` (pre-existing TS7016)

## Phase 3: Documentation

- [ ] 3.1 Update `README.md`: add `variant="polyhedron"  // optional; see Variants` to the `## React API` prop block, and replace the sentence "React support for the `variant` prop is planned for a later release." in `## Variants` with a `<Prismicon seed="maya" variant="polyhedron" state="working" />` example plus the rules (same ids as the core API; omitted → `DEFAULT_VARIANT_ID`; unknown id throws `RangeError` during render — wrap user-supplied ids in an error boundary; changing `variant` remounts the glyph; `state` changes still never remount) — verify: `grep -c "planned for a later release" README.md` prints `0`; `grep -c 'variant="polyhedron"' README.md` ≥ 2; `grep -n "^## " README.md` shows `## React API`, `## Vanilla API`, `## Variants`, `## Derivation spec v1 (frozen)` still in that order

## Phase 4: Gate and hand-off

- [ ] 4.1 Merge `origin/main` (merge, never rebase), then run the complete gate: `npm ci && npm test 2>&1 | grep -E "^# (tests|fail)"` prints `# tests` ≥ 60 and `# fail 0`; `git diff --quiet origin/main -- src/core.js src/index.js src/variants test/prismicon.test.js test/variants.test.js test/renderer-dispatch.test.js test/golden-v1.test.js test/derivation-freeze.test.js test/fixtures package.json demo` exits 0; `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures/golden-v1.json` exits 0; `npm pack --dry-run 2>&1 | grep -E "src/|index.d.ts|test/|scripts/"` lists `src/react.js` and `index.d.ts` and nothing under `test/` or `scripts/`; the `index.d.ts` compile check from 2.2 still prints `1` — verify: every command exits 0 and outputs match
- [ ] 4.2 Set roadmap `status: in-review`, `next-step: ""`, tick this step, commit and push — verify: `git status --porcelain` is empty and `git log origin/feature/react-variant-selection -1 --format=%s` shows the roadmap commit
