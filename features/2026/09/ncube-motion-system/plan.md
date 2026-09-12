# N-cube motion system

## Problem

The n-cube family (`ncube`, `ncube-3` … `ncube-6`) shipped static: its `pose` hook
returns the seed-derived rest orientation for every state and `animate` returns
`ctx.rest` on the first `settling` frame, so a mounted n-cube never moves — only the
shared status ring and the flash effects react to lifecycle states
([src/variants/ncube.js](../../../../src/variants/ncube.js#L166-L173), README
`### N-cube family` "Motion is deliberately static in this release"). The polyhedron
default, by contrast, spins, sways, wobbles, bobs and bursts per state
([src/variants/polyhedron.js](../../../../src/variants/polyhedron.js#L226-L296)).

This feature gives every registered dimension a motion model appropriate to how it is
represented on the 3D plane: cubes rotate in 3D, while 4- to 6-cubes rotate in their
highest-dimensional plane so their nested cells turn inside-out (the classic tesseract
motion) on top of a slow 3D spin. Every lifecycle state gets a choreography that mirrors
the polyhedron's, motion is deterministic at rest (static markup, SSR output and the
reduced-motion portrait stay byte-identical to today), and rendering cost is measured
and gated per dimension.

It implements the `### ncube-motion-system` member of the
[scalable-icon-variants breakdown](../../../../initiatives/2026/09/scalable-icon-variants/breakdown.md)
(initiative `scalable-icon-variants`, wave 4; requires `ncube-geometry-family`, which
is `complete`; recommended after `react-variant-selection`, also `complete`).

Member brief (verbatim): *Animate each dimensional n-cube appropriately for its
representation in a 3D plane.* Member summary: *Add dimension-aware n-cube animation
and transitions that remain deterministic at rest, integrate with lifecycle states, and
honor reduced-motion preferences.*

User-visible effect: `mountGlyph(el, seed, { variant: 'ncube-4', state: 'working' })`
and `<Prismicon variant="ncube-4" state="working" />` show a tesseract turning
inside-out; `waiting`, `thinking`, `sleeping`, `sending`, `receiving`, `done` and
`error` animate as they do for the polyhedron; `renderStaticSVG`, SSR and
`prefers-reduced-motion` output are unchanged.

## Decisions

Clarifying questions asked on 2026-09-12 and the user's answers (verbatim selections):

1. **Motion vocabulary** — What should "dimension-aware" n-cube motion look like in the
   working state (the primary animated state)?
   → **Higher-plane rotation + slow 3D spin** (*For d≥4 rotate continuously in the
   highest-dimensional plane (theta[d-4]) so cells turn inside-out like a classic
   tesseract, plus a slow 3D spin; d=3 spins in 3D only (its only option). Higher planes
   cascade slower as d grows.*)
2. **Secondary states** — How should waiting / thinking / sleeping / sending / receiving /
   settling behave?
   → **Mirror polyhedron's choreography** (*waiting = gentle sway, thinking = wobble +
   nod, sleeping = slow bob, sending/receiving = decaying burst spin (in the highest
   plane for d≥4), settling = ease back to the seed rest pose.*)
3. **Seed-derived motion traits** — Motion needs per-icon traits (speed, direction,
   phase). Where should they come from?
   → **Derive from existing ncube-v1 values, no new PRNG draws** (*Compute
   speed/direction/phase in prepare() from params.hash and the existing angles.
   ncube-v1 identities, the freeze fixture and static goldens stay byte-identical; spec
   stays 'ncube-v1'.*)
4. **Performance budget** — A 6-cube repaints ~26 KB of SVG per frame (shaded). How
   should rendering cost be bounded?
   → **Measure and gate: extend measure-ncube.mjs with an animated-frame benchmark**
   (*Record median animate+paint per frame per dimension in evidence/; acceptance
   requires every registered dimension under a fixed budget (e.g. ≤ 2 ms in Node) at the
   engine's ~30 fps, plus a browser check of the demo at d=6.*)
5. **Demo & scope** — Should this feature also add an n-cube lifecycle row to
   demo/index.html, and is React out of scope?
   → all three selected: **Add a demo row cycling one n-cube per dimension through the
   lifecycle states**; **React stays untouched; only a React SSR/hydration regression
   test for an animated n-cube is added**; **Update README `### N-cube family` to
   describe the motion model**.

## Research

Skills consulted: modern-javascript-patterns (pure hook functions, `const`, spread
over mutation, frozen pose objects, no shared mutable state in `animate`);
vercel-react-best-practices (reviewed for the React regression test: `src/react.js`
already renders a static portrait on the server and mounts once on hydrate without
remounting on `state` changes, so no component change is warranted — the rule
`rerender-` guidance confirms only a test is added).

### Engine contract the motion must fit

- [src/core.js](../../../../src/core.js#L93-L180) `mountGlyph`: `rest = variant.pose(p,
  'idle')`; the initial pose is `variant.pose(p, 'working')` only when mounted in
  `working` without reduced motion; `setState` maps `working|waiting|thinking|sleeping`
  to persistent engine states, `sending|receiving` to transients (`transientT` reset),
  and `idle|done|error` to `settling`. Under reduced motion `setState` paints
  `inst.rest` directly and never enqueues frames.
- [src/core.js](../../../../src/core.js#L253-L290) `step`: called at most every 33 ms
  with `dt ≤ 0.05 s`; `nextPose = variant.animate(inst.pose, { params, state, dt, t,
  transientT, rest })`; repaint happens only when `nextPose !== inst.pose` or a flash is
  active; `settling → idle` fires **only when `animate` returns the very object
  `inst.rest`**; transients switch to `settling` after `transientT > 0.4`. So the n-cube
  `animate` must (a) return the input object whenever nothing changes, (b) return a new
  object per moving frame, and (c) return `ctx.rest` by identity once settled.
- [src/variants/registry.js](../../../../src/variants/registry.js#L1-L45) documents
  the eight hooks; `pose` shape is variant-private (`Pose` generic in
  [index.d.ts](../../../../index.d.ts#L138-L158)), so adding plane angles to the
  n-cube pose is a compatible change for consumers — only `NcubeParams` is public.
- [src/variants/validate.js](../../../../src/variants/validate.js#L1-L30) probes
  determinism and SSR safety over `PROBE_STATES` with `ANIMATE_DT = 1/60`; the motion
  hooks must stay pure functions of `(pose, ctx)`.

### Current n-cube hooks and painting

- [src/variants/ncube.js](../../../../src/variants/ncube.js#L119-L143) `projectTo3(geo,
  p)` reads the plane angles from **`p.theta`** (params), so today the projection
  cannot move per frame. [`paintNcube`](../../../../src/variants/ncube.js#L174-L212)
  applies `rot3(v, o.ax, o.ay, o.az)` from the pose after projection. Moving the
  theta lookup to the pose (`o.theta`) is what enables hyper-rotation; at rest the pose
  carries `params.theta`, so static output is unchanged.
- [`prepareNcube`](../../../../src/variants/ncube.js#L160-L163) already returns
  non-identity derived fields (`strokeWidth`); motion traits belong there per Decision 3.
- `deriveNcube` params: `{ spec, seed, hash, dimension, finish, theta[MAX-3], ax, ay, az,
  hue, hue2 }`; `hash` is a 53-bit `cyrb53` integer
  ([src/variants/seed.js](../../../../src/variants/seed.js)). `theta` has exactly
  `NCUBE_MAX_DIMENSION - 3 = 3` entries; a `d`-cube uses `theta[0 … d-4]` (axis `k` →
  `theta[k-3]`), the highest plane of a `d`-cube is `theta[d-4]`.
- The polyhedron's `angDiff` and `wrapAngle`
  ([src/variants/polyhedron.js](../../../../src/variants/polyhedron.js#L133-L145)) are
  private module functions; the n-cube module needs the same easing helpers.

### Tests and fixtures affected

- [test/ncube.test.js](../../../../test/ncube.test.js#L233-L262) "hooks: pose returns
  the same frozen rest orientation for every state" (`deepEqual(rest, { ax, ay, az })`)
  and "hooks: animate returns its input outside settling and ctx.rest inside it" encode
  the static behaviour and must be rewritten for the motion contract;
  [L354-L365](../../../../test/ncube.test.js#L354-L365) "render: working state never
  repaints a static n-cube across frames" inverts (working must repaint);
  [L300-L318](../../../../test/ncube.test.js#L300-L318) "static markup equals the mounted
  markup at rest", [L367-L386](../../../../test/ncube.test.js#L367-L386) reduced motion
  and [L388-L403](../../../../test/ncube.test.js#L388-L403) "setState through every
  STATES entry … settles back to rest" must keep passing unchanged — the latter is the
  regression guard that settling returns to the exact rest markup.
- [test/fixtures/golden-ncube-v1.json](../../../../test/fixtures/golden-ncube-v1.json)
  (variants `ncube`, `ncube-4`; written by
  [scripts/generate-golden.mjs](../../../../scripts/generate-golden.mjs)) pins 30
  static SVG strings **and** mounted frame hashes across `working` (10 frames) and every
  state (4 frames each) via [test/helpers/golden.js](../../../../test/helpers/golden.js#L15-L27).
  The mounted hashes will legitimately change; the static entries must not
  (`git diff` on the fixture must touch only `"mounted"` blocks).
- [test/fixtures/ncube-v1-identities.json](../../../../test/fixtures/ncube-v1-identities.json)
  and [test/ncube-derivation-freeze.test.js](../../../../test/ncube-derivation-freeze.test.js)
  pin `deriveNcube` output; Decision 3 keeps them byte-identical, and the
  `Object.keys(p).sort()` assertion in `test/ncube.test.js` L163 stays valid because
  no param is added.
- [test/prismicon.test.js](../../../../test/prismicon.test.js#L108-L130) "React state
  updates keep the mounted SVG live so working geometry rotates" and
  [test/react-variant.test.js](../../../../test/react-variant.test.js#L132-L146)
  "hydration of an explicit variant has no recoverable errors" are the templates for
  the React SSR/hydration regression test with an animated n-cube.
- [test/variants.test.js](../../../../test/variants.test.js#L275-L298) pins the
  eighteen-name `src/index.js` surface; this plan adds no public export.
- Test runner: `node --test test/*.test.js` with JSDOM and a fake
  `requestAnimationFrame` queue (see `installDom` in `test/ncube.test.js`).

### Measurement tooling

- [scripts/measure-ncube.mjs](../../../../scripts/measure-ncube.mjs) (unpublished)
  measures static `paint()` time only; it builds ad-hoc `measure-<d>-<finish>`
  descriptors reusing `poseNcube`/`animateNcube`/`paintNcube`, so an animated-frame
  benchmark (working-state `animate` + `paint` per frame) slots in alongside. Existing
  static medians at size 64: d=6 shaded 0.28 ms, wireframe 0.075 ms
  ([evidence/ncube-bounds.txt](../ncube-geometry-family/evidence/ncube-bounds.txt)).
  The engine caps frames at ~30 fps ([src/core.js](../../../../src/core.js#L236-L244)),
  so a 2 ms per-frame budget leaves >90 % of a 33 ms frame for layout/paint of the
  innerHTML swap.

### Public surface, docs and demo

- [index.d.ts](../../../../index.d.ts#L38-L52) `NcubeParams` lists the identity
  fields; `GlyphHandle.params` returns the **prepared** params, so the new non-identity
  motion fields need to be declared there (as `strokeWidth` should have been — it is
  currently absent from the type and is returned by `prepareNcube`).
- [README.md](../../../../README.md#L148-L163) `### N-cube family` states motion is
  deferred to this feature; [L53-L68](../../../../README.md#L53-L68) `## States (agent
  kind)` documents the polyhedron motion per state.
- [demo/index.html](../../../../demo/index.html#L40-L46) "Dimensions (n-cube family)"
  row mounts one `ncube-<d>` per id at `state: 'idle'` and re-mounts on seed input; the
  hero `<select>` already lets a user drive any n-cube through every state.
- Package: `"sideEffects": false`, `"files": ["src", "index.d.ts", "README.md",
  "LICENSE"]`, no build step ([package.json](../../../../package.json)).

### Lint baseline and overlap decision (policy §5)

- AGENTS.md declares `Lint: none`, `Typecheck: none`; full verification is `npm test`.
- Baseline run on 2026-09-12 at `origin/main` `b90aaba` in this planning worktree:
  `npm ci && npm test` → exit 0, `# tests 114`, `# suites 9`, `# pass 114`, `# fail 0`.
- Findings: none. Overlap: not applicable. The gate for this delivery is therefore the
  **full** `npm test` run (never a changed-files subset) plus the additional machine
  checks in the acceptance checklist (golden regeneration diff restricted to mounted
  blocks, identity fixture unchanged, `index.d.ts` compile check with the single
  pre-existing TS7016 for `react`, `npm pack --dry-run` file list).
- Concurrent deliveries: `gh pr list --state open --json number,headRefName` returned
  `[]` on 2026-09-12; `feature/ncube-motion-system` did not exist locally or on
  `origin`. No overlapping branch exists.

## Approach

### Pose carries the plane angles

- The n-cube pose becomes `{ ax, ay, az, theta }` where `theta` is a frozen array with
  the same length as `params.theta` (`NCUBE_MAX_DIMENSION - 3`). `poseNcube(params,
  state)` returns the same frozen rest pose `{ ax: params.ax, ay: params.ay, az:
  params.az, theta: params.theta }` for **every** state (including `working`): motion
  always starts from rest, so the first mounted frame equals the static portrait and
  the existing "static equals mounted at rest" tests keep passing.
- `projectTo3(geo, p, theta)` takes the plane angles from the pose; `paintNcube` passes
  `o.theta`. At rest `o.theta === params.theta`, so every static SVG byte is unchanged
  (guarded by the golden static entries).

### Motion traits from existing `ncube-v1` values (no new draws, spec stays `ncube-v1`)

`prepareNcube` adds non-identity fields computed from `params.hash` and the existing
angles, so `deriveNcube` output, the identity fixture and the golden static entries are
untouched:

| Field | Derivation | Meaning |
|---|---|---|
| `dir` | `hash % 2 === 0 ? 1 : -1` | Sense of the hyper-rotation / burst |
| `hyperSpeed` | `(0.55 + (Math.floor(hash / 2) % 256) / 255 * 0.35) / (1 + 0.25 * (dimension - 4))` for d ≥ 4; `0` for d = 3 | rad/s of the highest plane `theta[d-4]`; slower as `d` grows so 5- and 6-cubes stay legible |
| `spinAxis` | `Math.floor(hash / 512) % 3` → `'ax' \| 'ay' \| 'az'` | Which 3D angle drifts in `working` |
| `spin3` | `dir * 0.22` for d ≥ 4; `dir * (0.45 + (Math.floor(hash / 1536) % 256) / 255 * 0.4)` for d = 3 | rad/s of the slow 3D spin (a cube's only working motion, so it is faster) |
| `phase`, `phase2` | `params.ax`, `params.ay` | Sway/wobble phase offsets (reuse existing angles) |

Constants are documented in the module header as tunable, non-identity values; the
Builder may adjust magnitudes within ±30 % for legibility as long as the tests in this
plan pass and the README table matches the code.

### `animateNcube(pose, ctx)` per engine state (mirrors the polyhedron)

Helpers `angDiff(target, cur)` and `wrapAngle(a)` are exported from
`src/variants/polyhedron.js` (pure additive export — v1 output cannot change) and
imported by `ncube.js` next to `PALETTE`/`FINISH_NAMES`. Let `d = params.dimension`,
`top = d - 4` (index of the highest plane), `k(rate) = Math.min(1, dt * rate)`.

- `idle`, `done`, `error` → return `pose` unchanged (no repaint; the engine drives the
  flash).
- `working` → `theta[top] += dir * hyperSpeed * dt` (wrapped); every lower plane
  `theta[i]` for `i < top` advances at `hyperSpeed * 0.4^(top - i)` (the cascade);
  `theta[i]` for `i > top` stays at rest. The 3D `spinAxis` angle advances by `spin3 *
  dt` (wrapped) while the other two 3D angles ease to rest with `k(3)`. For d = 3 there
  is no plane rotation; the cube spins on `spinAxis` at `spin3`.
- `waiting` → `ax`, `ay` ease with `k(3.5)` toward `rest.ax + sin(t·0.8 + phase)·0.05`
  and `rest.ay + sin(t·0.55 + phase2)·0.10`; `az` and every `theta[i]` ease to rest.
- `thinking` → `ax`/`ay` ease with `k(2.2)` toward the polyhedron wobble + nod targets
  (`sin(t·0.6 + phase)·0.10`, `sin(t·0.45 + phase2)·0.08`, nod
  `max(0, sin(t·0.35 + phase))·0.12`); for d ≥ 4 the highest plane eases toward
  `rest.theta[top] + sin(t·0.5 + phase)·0.12` (a slow hyper-wobble); other planes ease
  to rest.
- `sleeping` → `ax` eases with `k(1.2)` toward `rest.ax + sin(t·0.25 + phase)·0.03`;
  everything else eases to rest.
- `sending` / `receiving` → burst `spin = hyperSpeed·3.2·exp(−transientT·7)` applied to
  `theta[top]` (d ≥ 4) or `spin3·3.2·exp(−transientT·7)` applied to `spinAxis` (d = 3),
  sign `+` for sending and `−` for receiving; `ax` eases to rest with `k(4)`; other
  angles unchanged.
- `settling` → every angle (`ax`, `ay`, `az`, `theta[*]`) eases toward `rest` with
  `k(4.5)` through `angDiff`; when all absolute differences are `< 0.015` return
  **`ctx.rest` itself** so the engine flips to `idle`.
- Any frame that changes nothing returns the input `pose` (no repaint). Every moving
  frame returns a **new** frozen object with a new `theta` array; the input is never
  mutated.

### Animated-frame benchmark and gate

`scripts/measure-ncube.mjs` gains a second table: for each registered dimension and
finish, mount-free simulation of 60 working frames (`dt = 1/30`) followed by the
transient and settling paths (`sending` 12 frames, `settling` until `rest`), timing
`animate + paint` per frame with the five golden seeds; report the median and p95 per
dimension/finish and the number of settling frames. Gate: **median `animate + paint`
≤ 2 ms and p95 ≤ 4 ms for every registered dimension and finish at size 64 on Node**,
and settling completes within 60 frames from any state. Output is committed to
`evidence/ncube-motion-frames.txt`; the README support table gains a "median frame ms"
column. `NCUBE_MAX_DIMENSION` is not changed by this feature (it is frozen with
`ncube-v1`); if a dimension failed the frame gate the plan would reduce that
dimension's motion, but the static measurements (0.28 ms max) make that unlikely.

### Tests

- `test/ncube.test.js`: rewrite the two static hook tests and the "never repaints"
  test for the motion contract; add: rest pose includes `theta === params.theta` and is
  identical for every state; `working` changes `theta[d-4]` monotonically by
  `dir·hyperSpeed·dt` (d ≥ 4) and leaves `theta[i > top]` at rest; d = 3 never changes
  `theta`; a 60-frame `working` run keeps all coordinates in `[0, 100]` for every
  id/finish; `settling` from a perturbed pose returns `ctx.rest` by identity within
  60 frames; `sending`/`receiving` rotate in opposite directions; non-moving states
  return the input object; `animate` never mutates its input (frozen pose + deep
  compare); mounted `working` n-cube repaints across frames and returns to the exact
  rest markup after `idle`; reduced-motion test unchanged and still passing;
  `prepareNcube` motion fields are deterministic and within the documented ranges.
- `test/react-variant.test.js`: add "hydration of an animated n-cube has no
  recoverable errors and rotates after frames" — SSR `renderToString` with
  `variant: 'ncube-4', state: 'working'`, hydrate in JSDOM with a fake rAF queue,
  assert zero recoverable errors, static markup identical pre-hydration, and the
  `<g>` innerHTML differs after advancing frames while `state="working"`.
- `scripts/generate-golden.mjs` regenerates `golden-ncube-v1.json`; the diff must be
  confined to `mounted` blocks (checked with a `node` one-liner comparing the `static`
  objects before/after); `golden-v1.json` unchanged.
- `validateVariant(ncube)` and each `ncube-<d>` continue to pass the determinism and
  SSR probes (assert in `test/ncube.test.js`).

### Types, docs, demo

- `index.d.ts`: extend `NcubeParams` with the prepared, non-identity fields
  (`strokeWidth`, `dir`, `hyperSpeed`, `spinAxis`, `spin3`, `phase`, `phase2`) marked
  optional/readonly with JSDoc "present on `GlyphHandle.params` (prepared), not in
  `deriveNcube` output"; no other type changes.
- `README.md` `### N-cube family`: replace the "deliberately static" bullet with a
  "Motion model" subsection (per-state table mirroring `## States`, the highest-plane
  rule, cascade, d = 3 special case, trait derivation with the "no new draws" guarantee,
  reduced-motion behaviour) and add the frame-time column to the support table.
- `demo/index.html`: a "Lifecycle (n-cube family)" row mounting one `ncube-<d>` per
  registered id at size 72 for the seed input, with a shared button strip (the same
  `STATES` as the hero) that calls `setState` on every glyph in the row, so all four
  dimensions can be compared in the same state; verified by serving the repo root on
  the slug port and screenshotting `working` and `thinking`.

### Affected files

`src/variants/ncube.js`, `src/variants/polyhedron.js` (export two helpers only),
`index.d.ts`, `README.md`, `demo/index.html`, `scripts/measure-ncube.mjs`,
`test/ncube.test.js`, `test/react-variant.test.js`,
`test/fixtures/golden-ncube-v1.json` (mounted blocks only),
`features/2026/09/ncube-motion-system/evidence/*`. Not touched: `src/core.js`,
`src/react.js`, `src/index.js`, `src/variants/registry.js`, `src/variants/validate.js`,
`src/variants/index.js`, `src/variants/seed.js`, `package.json`,
`test/fixtures/golden-v1.json`, `test/fixtures/ncube-v1-identities.json`.

## Risks

- **Static output drifts while moving `theta` into the pose.** Mitigation: the golden
  static entries, the "static equals mounted at rest" test and the reduced-motion test
  are the gate; the roadmap runs them right after the pose refactor and before any
  motion is added.
- **Settling never reaches `ctx.rest` by identity** (engine would stay in `settling`
  forever and keep repainting). Mitigation: explicit unit test that `settling` from a
  perturbed pose returns the `rest` object within 60 frames, plus the existing
  "settles back to rest markup" test and the benchmark's settling-frame count.
- **6-cube frame cost in real browsers** (26 KB innerHTML swap at 30 fps, beyond what
  Node measures). Mitigation: the Node gate bounds the JS cost; the demo lifecycle row
  is driven in a browser with all four dimensions in `working` and a screenshot plus
  the DevTools-free observation (no dropped-frame stutter, page stays responsive) is
  recorded; if it stutters, reduce `hyperSpeed`/cascade for d = 6 within the plan's
  tuning latitude rather than changing the engine.
- **Hash-derived traits cluster** (few distinct speeds). Mitigation: 256-step
  quantization per trait and independent bit ranges of the 53-bit hash; a test asserts
  the five golden seeds do not all share `dir`/`spinAxis`.
- **Golden mounted hashes must be regenerated** and could hide an unintended static
  change. Mitigation: acceptance requires a scripted comparison proving the `static`
  objects are equal before and after regeneration.
- **Concurrent delivery**: no open PRs at planning time; the Builder still merges
  `origin/main` before every push (policy §7). `variant-build-tooling` (same wave) may
  start in parallel and touch `scripts/` and README; sequence README/`scripts/` edits
  by integrating `origin/main` before each push.

## Out of scope

- Changing `NCUBE_MAX_DIMENSION`, the `ncube-v1` draw order, or any identity param.
- Engine changes in `src/core.js` (frame cadence, per-dimension throttling, new `ctx`
  fields) and React component changes in `src/react.js`.
- New public exports from `src/index.js` or authoring/validation tooling
  (`variant-build-tooling`).
- Polyhedron motion changes; the exported `angDiff`/`wrapAngle` helpers are additive.
- A different visual family (`alternate-visual-variant`) or CSS/SMIL-based animation.
- `package.json` changes (no version bump; release is handled at ship time).

## Acceptance checklist

- [ ] `npm test` exits 0 with `# fail 0` and at least 114 + the new motion tests; `node scripts/generate-golden.mjs && git diff --quiet -- test/fixtures/golden-v1.json test/fixtures/ncube-v1-identities.json` exits 0.
- [ ] After regeneration, `test/fixtures/golden-ncube-v1.json` differs from `origin/main` only inside `mounted` blocks: `node -e` comparison of the `static` objects for `ncube` and `ncube-4` between `git show origin/main:test/fixtures/golden-ncube-v1.json` and the working file prints `static-equal: true` (command recorded in roadmap step 1.4).
- [ ] `poseNcube(p, state)` returns a frozen `{ ax, ay, az, theta }` with `theta === p.theta` for every state in `[...STATES, 'settling']`; `renderStaticSVG` output for every n-cube id and finish is byte-identical to `origin/main` (asserted via the golden static entries and `test/ncube.test.js`).
- [ ] `deriveNcube` output is unchanged (`test/ncube-derivation-freeze.test.js` passes against the untouched fixture) and `prepareNcube` adds `dir`, `hyperSpeed`, `spinAxis`, `spin3`, `phase`, `phase2` deterministically within the documented ranges (asserted in `test/ncube.test.js`).
- [ ] In `working`, for every seed and d ≥ 4, `theta[d-4]` advances by `dir·hyperSpeed·dt` per frame and `theta[i]` for `i > d-4` stays at rest; for d = 3 `theta` never changes and the `spinAxis` angle advances by `spin3·dt`; 60 working frames keep every emitted coordinate within `[0, 100]` for every id and finish (asserted in `test/ncube.test.js`).
- [ ] `waiting`, `thinking`, `sleeping`, `sending`, `receiving` each return a new object that differs from the input on the first frame; `sending` and `receiving` move `theta[d-4]` (or the d = 3 spin axis) in opposite directions; `idle`, `done`, `error` return the input object; no state mutates its input (asserted in `test/ncube.test.js`).
- [ ] `settling` from a perturbed pose returns `ctx.rest` by identity within 60 frames at `dt = 1/30`; a mounted n-cube driven through every `STATES` entry ends at the exact rest markup (existing test) and a mounted `working` n-cube repaints between frames (asserted in `test/ncube.test.js`).
- [ ] Under reduced motion a mounted `ncube-4` in `working` enqueues zero frames and equals the static markup through every state (existing test unchanged and passing); `validateVariant` passes for `ncube` and every `ncube-<d>`.
- [ ] `test/react-variant.test.js` "hydration of an animated n-cube" passes: SSR markup for `variant="ncube-4" state="working"` equals `renderStaticSVG`, hydration reports zero recoverable errors, and the glyph's `<g>` innerHTML changes after frames advance.
- [ ] `evidence/ncube-motion-frames.txt` (output of `node scripts/measure-ncube.mjs`) shows median `animate + paint` ≤ 2 ms and p95 ≤ 4 ms for every registered dimension and finish, and settling ≤ 60 frames from every state; the README support table carries the median frame column.
- [ ] `index.d.ts` `NcubeParams` declares the prepared motion fields; `npx -y -p typescript tsc --noEmit --strict --target es2020 --lib es2020,dom --types "" index.d.ts 2>&1 | grep -cE "error TS"` prints `1` and that line names `'react'` (pre-existing TS7016 only).
- [ ] README `### N-cube family` no longer says motion is static, documents the per-state motion model, the highest-plane/cascade rule, the d = 3 case and the "no new draws" trait derivation; `grep -n "^## " README.md` shows the section order unchanged.
- [ ] `demo/index.html` served at `local:3173` shows a "Lifecycle (n-cube family)" row with one glyph per `ncube-<d>` and a state button strip; screenshots of the row in `working` and `thinking` are committed under `evidence/` and the page stays responsive with all four dimensions animating.
- [ ] `git diff --quiet origin/main -- src/core.js src/react.js src/index.js src/variants/registry.js src/variants/validate.js src/variants/index.js src/variants/seed.js package.json test/fixtures/golden-v1.json test/fixtures/ncube-v1-identities.json` exits 0 at review time, and `git diff origin/main -- src/variants/polyhedron.js` adds only the `export` keyword to `angDiff` and `wrapAngle`.
- [ ] `npm pack --dry-run` lists no files under `test/`, `scripts/`, or `features/`.
