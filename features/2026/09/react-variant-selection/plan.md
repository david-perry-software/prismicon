# React variant selection

## Problem

Since wave 2 the core API selects a registered variant per icon —
`renderStaticSVG(seed, { variant })` and `mountGlyph(el, seed, { variant })` in
[src/core.js](../../../../src/core.js#L77-L173) resolve `opts.variant` through the
built-in registry and throw for unknown ids — but the React binding ignores it.
[src/react.js](../../../../src/react.js#L27-L52) destructures only `seed, size, kind,
state, dark, className, style, title`, calls `renderStaticSVG(seed, { size, kind, state,
dark })` for the server/first-paint markup and `mountGlyph(ref.current, seed, { kind,
size, dark, state })` on hydrate, so `<Prismicon variant="…" />` is silently dropped.
[index.d.ts](../../../../index.d.ts#L63-L72) `PrismiconProps` has no `variant`, and
[README.md](../../../../README.md#L126) still says *"React support for the `variant`
prop is planned for a later release."*

This feature implements the `### react-variant-selection` member block of
[scalable-icon-variants/breakdown.md](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
(wave 3; requires `variant-renderer-integration`, which is `status: complete`). Brief:
*"Support per-icon variants through every current API, including React."* Summary: add
typed per-icon variant selection to the React component while retaining deterministic
SSR, hydration stability, and state updates without remounting.

User-visible effect: `<Prismicon seed="x" variant="polyhedron" />` renders the named
variant on the server and hydrates into the same variant on the client; an unknown id
throws the core `RangeError` (non-string → `TypeError`) during render so SSR fails
loudly and client error boundaries catch it; changing `variant` remounts the glyph with
the current `state`; `state` changes still never replace the mounted `<svg>`. Omitting
`variant` keeps today's output byte-for-byte. `PrismiconProps.variant?: string` is
typed and the README documents it.

## Decisions

Clarifying questions were asked against the member brief; answers are verbatim.

1. **Unknown variant in React.** When `<Prismicon variant="nope" />` is rendered, what
   should happen?

   > Throw during render (mirrors core RangeError; caught by error boundaries, fails
   > SSR loudly)

2. **Variant prop change.** When the `variant` prop changes on a mounted component,
   what behaviour do you expect?

   > Remount the glyph (destroy + mountGlyph) like seed/size/kind/dark, preserving the
   > current `state`

3. **React entry exports.** Should `prismicon/react` re-export variant discovery
   (`listVariants`, `DEFAULT_VARIANT_ID`) so React consumers have a single import, or
   keep them only on `prismicon`?

   > Keep them only on `prismicon`; React entry exports just the component

4. **Browser verification.** Should the React component be verified in a real browser
   this wave (e.g. a small `demo/react.html` using an import map to esm.sh React), or
   is the Node/JSDOM suite (SSR + hydrate + act) sufficient?

   > Node/JSDOM suite only; no React demo page

5. **Ref / handle access.** Should this wave also expose the live `GlyphHandle` (e.g.
   via `ref`/`useImperativeHandle`) so React consumers can read `handle.variant`, or is
   that out of scope?

   > Out of scope; `variant` prop only

## Research

Skills consulted: modern-javascript-patterns, vercel-react-best-practices

**Lint baseline (policy §5).** [AGENTS.md](../../../../AGENTS.md) declares `Lint:
none`, `Typecheck: none`; the only verification command is `npm test`
(`node --test test/*.test.js`, [package.json](../../../../package.json) `scripts`).
Recorded on this worktree at `origin/main` (`a940391`, 2026-09-09):

- Before `npm ci` (fresh worktree, no `node_modules`): `npm test` exit 1 — 28 tests,
  25 pass, 3 fail: `test/golden-v1.test.js`, `test/prismicon.test.js`, and
  `test/renderer-dispatch.test.js` failed to load with `ERR_MODULE_NOT_FOUND: Cannot
  find package 'jsdom'`. Environment, not a code defect.
- After `npm ci` (exit 0, 42 packages): `npm test` exit 0 — **52 tests, 52 pass,
  0 fail**.

Overlap decision: there are no lint findings, so no cleanup and no scoped gate; the
complete gate is the full `npm test` run (52 baseline + every new test) at `# fail 0`,
plus the `index.d.ts` compile check inherited from wave 2 (see below), required by the
roadmap and acceptance checklist.

**Codebase findings** (evidence: file paths and lines at `a940391`).

- *Core already does the work.* `createRenderer(registry)`
  ([src/core.js](../../../../src/core.js#L77-L170)) builds `renderStaticSVG` and
  `mountGlyph`; both call `registry.resolve(opts.variant)` as their **first**
  statement (L81, L95), before option normalisation, `getEngine()`, or any DOM
  mutation. `registry.resolve(key)`
  ([src/variants/registry.js](../../../../src/variants/registry.js#L127-L136)) returns
  the default for `undefined`/`null`, throws `TypeError("Variant key must be a string;
  got <type>")` for non-strings, and `RangeError('Unknown prismicon variant "<id>";
  registered: <ids>')` for unknown ids. `handle.variant` is a getter returning the
  descriptor id (L154-L168). `renderStaticSVG` never touches `window`/`document`
  (SSR-safe).
- *Internal resolver available without new public surface.*
  [src/variants/index.js](../../../../src/variants/index.js#L17-L19) exports
  `resolveVariant(key, registry = BUILT_IN_VARIANTS)`; it is not re-exported from
  `src/index.js` (public surface is exactly 13 names, guarded by
  [test/variants.test.js](../../../../test/variants.test.js#L200-L220)). `src/react.js`
  is inside the package and may import it directly; `core.js` already imports
  `./variants/index.js`, so no import cycle is introduced.
- *React binding shape.* [src/react.js](../../../../src/react.js) is `'use client'`,
  `createElement`-only (no JSX, no build). `GlyphHost` is `memo`'d and receives the
  static markup via `dangerouslySetInnerHTML` (L16-L24). `initialMarkup` is a
  `useRef` computed once on first render (L38-L41) — never recomputed for prop
  changes, so a later identity-prop change does *not* rewrite `innerHTML`; the mount
  effect (L43-L52, deps `[seed, size, kind, dark]`) destroys and remounts instead.
  The effect body reads `state` from the render closure, so a remount always mounts
  with the *current* `state` prop — decision 2 is satisfied by adding `variant` to the
  deps with no extra bookkeeping. The `[state]` effect (L54-L56) calls
  `handle.setState`, which never replaces the `<svg>`.
- *Existing React tests.* [test/prismicon.test.js](../../../../test/prismicon.test.js)
  L1-L50 builds a JSDOM with mocked `matchMedia`, counted `requestAnimationFrame`, no
  `IntersectionObserver`, and restores globals `afterEach`; SSR is asserted with
  `renderToStaticMarkup` (L56-L64) and client behaviour with `createRoot` + `act`
  under `globalThis.IS_REACT_ACT_ENVIRONMENT = true` (L108-L128, L274-L286), asserting
  `<svg>` node identity across state updates and `aria-label` suffixes. There is no
  `hydrateRoot` test today. [test/renderer-dispatch.test.js](../../../../test/renderer-dispatch.test.js#L1-L40)
  repeats the same `installDom` harness (precedent for a self-contained new test file).
  The `square` fixture ([test/fixtures/square-variant.js](../../../../test/fixtures/square-variant.js))
  is only reachable through `createRenderer(createVariantRegistry([...]))`; the React
  component uses the module-default renderer over `BUILT_IN_VARIANTS`, so a React test
  cannot render `square` without a registry-injection prop (deliberately not added —
  that belongs to `custom-variant-authoring`). Forwarding is therefore proven by the
  behaviours only a forwarded prop can produce: explicit `'polyhedron'` equals the
  default, unknown ids throw, and a `variant` change remounts.
- *React 19 test hooks.* devDependencies pin `react`/`react-dom` `^19.2.0`
  ([package.json](../../../../package.json#L25-L29)); `createRoot(container, {
  onUncaughtError })` and `hydrateRoot(container, el, { onRecoverableError })` exist in
  19 and let tests capture render-time throws and hydration mismatches without
  scraping `console.error`. The runtime peer range stays `react >=17` (optional); the
  component itself uses only `createElement`, `memo`, `useEffect`, `useRef`.
- *Types.* [index.d.ts](../../../../index.d.ts#L27-L35) `GlyphOptions.variant?:
  string` already carries the "unknown ids throw RangeError" JSDoc; `PrismiconProps`
  (L63-L72) needs the matching member. The wave-2 compile check `npx -y -p typescript
  tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts 2>&1 |
  grep -cE "error TS"` prints `1` — the pre-existing TS7016 for the unresolved
  `'react'` import ([variant-renderer-integration/roadmap.md](../variant-renderer-integration/roadmap.md)
  step 4.2) — and that remains the expected count.
- *Docs.* [README.md](../../../../README.md#L71-L86) `## React API` is a JSX prop
  block; `## Variants` (L107-L126) ends with the "planned for a later release"
  sentence that this feature replaces.
- *Packaging.* exports `.` and `./react` both point `types` at `./index.d.ts`;
  `files` ships `src`, `index.d.ts`, `README.md`, `LICENSE`; `"sideEffects": false`.
  No `package.json` change is needed.
- *Demo.* [demo/index.html](../../../../demo/index.html) has no React usage; per
  decision 4 it stays untouched.

**Skill guidance applied.**

- *vercel-react-best-practices:* `rerender-dependencies` — `variant` is a primitive
  string dep, added to the existing primitive dep list; `rendering-hydration-no-flicker`
  — the server markup and the first client paint are produced by the same
  `renderStaticSVG(seed, { …, variant })` call so hydration markup is identical;
  `server-no-shared-module-state` — no new module-level state; validation is a pure
  registry lookup; `js-early-exit` — validate `variant` at the top of render, before
  markup generation or effects; `rerender-use-ref-transient-values` — keep the
  once-computed `initialMarkup` ref rather than recomputing markup per render.
- *modern-javascript-patterns:* destructuring with `variant` left `undefined` (the
  registry's documented "use default" input) instead of hard-coding
  `DEFAULT_VARIANT_ID` in React; explicit typed errors propagate unchanged; no data
  mutation; small single-purpose changes.

**Concurrent delivery.** `gh pr list --state open --json number,headRefName` returned
`[]`; no other delivery branch exists. Wave-3 siblings (`ncube-geometry-family`,
`custom-variant-authoring`) are `unplanned` but may start concurrently and touch
`README.md ## Variants` and `index.d.ts` — see Risks.

**Slug reservation.** `agento.mjs initiative scalable-icon-variants` → member
`react-variant-selection` `state: unplanned`, `ready: true`, `blockedBy: []`.
`agento.mjs find react-variant-selection` → `status: missing`; neither
`feature/react-variant-selection` nor `origin/feature/react-variant-selection` existed;
the branch was created from the detached `origin/main` HEAD (`a940391`) in this
planning worktree before any artifact was written.

## Approach

### `src/react.js`

- Import `resolveVariant` from `./variants/index.js` alongside the existing
  `renderStaticSVG, mountGlyph` import from `./core.js`.
- Destructure `variant` from props with no default (`undefined` → registry default).
- First statement of `Prismicon` after destructuring: `resolveVariant(variant);` — a
  pure `Map` lookup that throws `TypeError`/`RangeError` **during render** on every
  render (decision 1). This makes the initial and the updated-prop failure modes
  identical: the error surfaces before commit, the DOM is never touched, SSR
  (`renderToString`/`renderToStaticMarkup`) throws, and client error boundaries catch
  it. (Relying only on `renderStaticSVG` would cover the first render but an invalid
  *update* would otherwise destroy the live glyph and throw from the effect.)
- `initialMarkup.current = renderStaticSVG(seed, { size, kind, state, dark, variant })`.
- Mount effect: `mountGlyph(ref.current, seed, { kind, size, dark, state, variant })`
  with deps `[seed, size, kind, dark, variant]`. Because `state` is read from the
  render closure, a variant remount mounts with the current `state` prop (decision 2).
  The `[state]` effect is unchanged, so state changes still go through
  `handle.setState` and never replace the `<svg>`.
- No new exports from `src/react.js` (decision 3): the module keeps exactly
  `Prismicon` and `default`.

### `index.d.ts`

- Add `variant?: string` to `PrismiconProps` with JSDoc: omit for the default variant;
  unknown ids throw `RangeError` during render. No other type changes.

### `README.md`

- Add `variant="polyhedron"  // optional; see Variants` to the `## React API` prop
  block.
- Replace the "planned for a later release" sentence in `## Variants` with a short
  React example and the rules: same ids as the core API, omitted → default, unknown id
  throws during render (wrap in an error boundary if ids are user-supplied), changing
  `variant` remounts the glyph, `state` changes still do not remount.

### Tests — new `test/react-variant.test.js`

Self-contained JSDOM harness (same pattern as `test/renderer-dispatch.test.js`) so
`test/prismicon.test.js` stays byte-identical to `origin/main`. Cases:

1. **SSR parity** — `renderToStaticMarkup` of `{ seed: 'Ada Lovelace', size: 34,
   state: 'working', dark: true, variant: 'polyhedron' }` equals the same element
   without `variant`, and contains `renderStaticSVG('Ada Lovelace', { size: 34, state:
   'working', dark: true })`.
2. **SSR errors** — `variant: 'nope'` throws `RangeError` whose message names `nope`
   and `polyhedron`; `variant: 42` throws `TypeError`.
3. **Client mount with explicit variant** — `createRoot` + `act`, `variant:
   'polyhedron'`, `state: 'working'`: host gets class `prismicon`, `<svg>` aria-label
   matches `/^Ada Lovelace: .+, working$/`, rAF was requested.
4. **Client render-time throw** — `createRoot(container, { onUncaughtError })`;
   rendering `variant: 'nope'` reports exactly one `RangeError` and leaves
   `container.querySelector('svg')` null.
5. **Variant change remounts, preserving state** — mount `{ state: 'working' }`
   (svgA); re-render with `variant: 'polyhedron', state: 'working'` → `<svg>` is a new
   node (svgB ≠ svgA), aria-label still ends `, working`; then `state: 'done'` → same
   svgB node, aria-label ends `, done`.
6. **Invalid update is reported before the DOM changes** — after a successful mount,
   re-rendering with `variant: 'nope'` reports a `RangeError` through
   `onUncaughtError` and `container.querySelectorAll('svg').length ≤ 1` (no second
   glyph was mounted).
7. **Hydration** — `container.innerHTML = renderToString(el)` with `variant:
   'polyhedron'`, then `hydrateRoot(container, el, { onRecoverableError })` under
   `act`: zero recoverable errors, `<svg>` present with the `, working` label, host
   has class `prismicon`.
8. **React entry surface** — `Object.keys(await import('../src/react.js')).sort()`
   deep-equals `['Prismicon', 'default']` (decision 3).

Cases 2, 4, 5 (svgB ≠ svgA), and 6 must fail on `origin/main` (prop ignored) and pass
after the change; the roadmap verifies both.

### Verification target

Per decision 4 there is no served UI for this wave; React behaviour is verified by the
Node/JSDOM suite exactly as the existing React tests are, and `demo/index.html` is not
modified. No `local:`/`dev-stack`/`preview` target applies.

## Risks

- **Render-time validation on every render.** `resolveVariant` is one `Map.get` per
  render — negligible — but it means an invalid id throws even when the component
  would not otherwise remount. That is the requested behaviour (decision 1); the
  README tells consumers to wrap user-supplied ids in an error boundary.
- **React 19-only test APIs.** `onUncaughtError` and `onRecoverableError` root options
  are used only in tests (devDependency `react-dom ^19.2.0`); the shipped component
  uses nothing newer than the `react >=17` peer range. Mitigation: tests import those
  options from `react-dom/client`, never the component.
- **Hydration false positives.** React does not diff `dangerouslySetInnerHTML`
  content during hydration, so case 7 guards against attribute/structure mismatches
  and regressions in the `<span>` host, not SVG bytes; SVG determinism is covered by
  case 1 and the wave-2 golden suite. Case 7 must use `renderToString`, not
  `renderToStaticMarkup`.
- **Behaviour of an uncaught update error.** React 19 unmounts the root tree on an
  uncaught render error; case 6 therefore asserts only "error reported, no second
  glyph mounted" rather than a specific surviving DOM shape.
- **Concurrent wave-3 members.** `ncube-geometry-family` and
  `custom-variant-authoring` may edit `README.md ## Variants` and `index.d.ts`
  concurrently. Mitigation: merge `origin/main` before every push and before
  `status: in-review`; this branch touches only the React prop line, the React
  paragraph, and `PrismiconProps`.
- **Registry injection temptation.** Rendering the `square` fixture through React
  would need a registry/renderer prop; adding one now would pre-empt
  `custom-variant-authoring`. Mitigation: prove forwarding via throw/parity/remount
  behaviours (Approach) and leave injection to that wave.

## Out of scope

- Exposing the `GlyphHandle` through a ref or imperative handle (decision 5).
- Re-exporting `listVariants`/`DEFAULT_VARIANT_ID` from `prismicon/react`
  (decision 3).
- A React demo page or any browser verification (decision 4); `demo/index.html` is
  untouched.
- Silent or warned fallback to the default variant (decision 1).
- A `registry`/`renderer` prop for consumer registries — `custom-variant-authoring`.
- Any change to `src/core.js`, `src/index.js`, `src/variants/*`, `package.json`, the
  golden fixtures, or the frozen v1 derivation.

## Acceptance checklist

- [ ] `npm ci && npm test` exits 0 with `# fail 0` and `# tests` ≥ 60 (52 baseline
      + 8 new) — verified by running the command.
- [ ] `test/react-variant.test.js` exists and, checked out against `origin/main`
      `src/react.js`, fails on the SSR-error, client render-time throw, variant-change
      remount, and invalid-update cases (recorded in roadmap step 1.2) — verified by
      the roadmap's fail-first run and `git log` order (test commit precedes the
      `src/react.js` commit).
- [ ] `renderToStaticMarkup(<Prismicon … variant="polyhedron" />)` is byte-identical
      to the same element without `variant` and to `renderStaticSVG` wrapped in the
      host `<span>` — verified by `node --test test/react-variant.test.js`.
- [ ] Rendering with an unknown `variant` throws `RangeError` (non-string →
      `TypeError`) during render on the server and is reported via `onUncaughtError`
      on the client with no `<svg>` mounted — verified by `node --test
      test/react-variant.test.js`.
- [ ] Changing `variant` on a mounted component replaces the `<svg>` node and mounts
      with the current `state`; a subsequent `state` change keeps the same node —
      verified by `node --test test/react-variant.test.js`.
- [ ] `hydrateRoot` over `renderToString` markup with `variant` set reports zero
      recoverable errors — verified by `node --test test/react-variant.test.js`.
- [ ] `src/react.js` exports exactly `Prismicon` and `default` — verified by
      `node --test test/react-variant.test.js`.
- [ ] `index.d.ts` `PrismiconProps` declares `variant?: string`; `grep -c "variant?:
      string" index.d.ts` prints `2` and `npx -y -p typescript tsc --noEmit --strict
      --target es2020 --lib es2020,dom --types "" index.d.ts 2>&1 | grep -cE "error
      TS"` prints `1` (the pre-existing `'react'` TS7016 only).
- [ ] `README.md` `## React API` block lists `variant` and `## Variants` no longer
      contains "planned for a later release" but documents React usage — verified by
      `grep -c 'variant=' README.md` ≥ 1 and `grep -c "planned for a later release"
      README.md` prints `0`.
- [ ] No collateral change: `git diff --quiet origin/main -- src/core.js src/index.js
      src/variants test/prismicon.test.js test/variants.test.js
      test/renderer-dispatch.test.js test/golden-v1.test.js
      test/derivation-freeze.test.js test/fixtures package.json demo` exits 0, and
      `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures/golden-v1.json`
      exits 0.
- [ ] `npm pack --dry-run` lists `src/react.js` and `index.d.ts` and nothing under
      `test/` or `scripts/`.
- [ ] Lint gate (policy §5): AGENTS.md declares no lint/typecheck command; the
      complete `npm test` gate passes against the recorded 52-test baseline with no
      lint findings to compare.
