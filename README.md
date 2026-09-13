# prismicon

Deterministic 3D identicons. Every seed string maps to a unique polyhedron — a spinning prism, pyramid, bipyramid, or antiprism with its own side count, finish, proportions, and color — that doubles as a live status indicator for agents and background jobs.

Zero dependencies. No build step. SSR-safe. ~9 KB of plain ES modules.

## Install

```bash
npm install prismicon
```

For local development across sibling folders, a file dependency also works:

```bash
npm install ../prismicon
```

## Next.js usage

The React binding is a client component (it drives a shared animation loop), but it renders a deterministic static SVG on the server first, so there is no flash of empty content.

```jsx
// app/components/AgentBadge.jsx
import { Prismicon } from 'prismicon/react';

export function AgentBadge({ agentId, status }) {
  return <Prismicon seed={agentId} kind="agent" state={status} size={48} />;
}
```

```jsx
// A static user avatar — never animates, costs nothing after first paint.
<Prismicon seed={user.id} kind="user" size={32} />
```

Server components can also render pure static markup with no client JS at all:

```jsx
import { renderStaticSVG } from 'prismicon';

export function StaticAvatar({ id }) {
  return <span dangerouslySetInnerHTML={{ __html: renderStaticSVG(id, { size: 32, kind: 'user' }) }} />;
}
```

## The two kinds

**`kind="user"`** is an identity mark: always the static portrait pose, no lifecycle, ignores `state`. Use it for people.

**`kind="agent"`** adds the lifecycle. Use it for bots, jobs, pipelines — anything with a status worth watching.

## States (agent kind)

| State | Motion | Persistent ring |
|---|---|---|
| `idle` | none — portrait pose | none |
| `working` | identity-specific spin or tumble | none |
| `waiting` | gentle sway | dotted amber |
| `done` | settles with a green flash | solid green |
| `error` | settles with a red flash and shake | dashed red |
| `thinking` | slow precessing wobble with a periodic nod | long-dash blue (pulsing) |
| `sending` | brief spin-up that settles back to portrait | one-shot expanding ripple |
| `receiving` | brief reverse spin-up with a lightening flash, then settles | one-shot contracting ripple |
| `sleeping` | very slow bob, dimmed | none |

The ring patterns (solid / dashed / dotted / long-dash / ripple) carry the status without color, so the states remain distinguishable for colorblind users and in grayscale. `aria-label` on each glyph announces identity and state and updates live.

`waiting` means blocked on something external (approval, input, an upstream dependency) — it keeps a ring because it needs a human's attention. `working` means busy internally. Keeping that distinction honest keeps your dashboard honest.

## React API

```jsx
<Prismicon
  seed="build-bot-7"   // required — any string; identity derives from it
  size={64}            // px, default 64
  kind="agent"         // 'agent' | 'user', default 'agent'
  state="working"      // GlyphState, default 'idle' (ignored for kind='user')
  dark={isDarkMode}    // optional; defaults to prefers-color-scheme
  variant="polyhedron"  // optional; see Variants
  className="…"
  style={{ … }}
  title="build-bot-7"
/>
```

If your app switches themes with a class rather than the media query, pass `dark` explicitly so the shading ramp matches your surface.

## Vanilla API

```js
import { mountGlyph, renderStaticSVG, deriveV1, describeParams } from 'prismicon';

const handle = mountGlyph(document.getElementById('badge'), 'crawler-2', {
  kind: 'agent', size: 48, state: 'working'
});
handle.setState('done');
console.log(handle.variant); // → 'polyhedron'
handle.destroy();

renderStaticSVG('maya', { size: 32, kind: 'user' }); // → '<svg …>'
renderStaticSVG('maya', { variant: 'polyhedron' }); // explicit variant id

const p = deriveV1('maya');
describeParams(p); // → 'pentagon bipyramid, two-tone, tall'
```

## Variants

Variants are separate visual styles registered with the renderer. The built-in `polyhedron` variant is the default and remains unchanged, so existing code keeps working. The n-cube family (`ncube`, `ncube-3` … `ncube-6`) is the second built-in.

```js
import { renderStaticSVG, mountGlyph, DEFAULT_VARIANT_ID, listVariants } from 'prismicon';

listVariants();
// → [
//   { id: 'polyhedron', label: 'Polyhedron',           spec: 'v1' },
//   { id: 'ncube',      label: 'N-cube',               spec: 'ncube-v1' },
//   { id: 'ncube-3',    label: '3-cube (cube)',        spec: 'ncube-v1' },
//   { id: 'ncube-4',    label: '4-cube (tesseract)',   spec: 'ncube-v1' },
//   { id: 'ncube-5',    label: '5-cube (penteract)',   spec: 'ncube-v1' },
//   { id: 'ncube-6',    label: '6-cube (hexeract)',    spec: 'ncube-v1' }
// ]

renderStaticSVG('maya', { variant: 'polyhedron' });
const handle = mountGlyph(el, 'maya', { variant: 'ncube-4', state: 'working' });
```

- Pass `variant` to either `renderStaticSVG` or `mountGlyph` to pick a style.
- Omit `variant` to get `DEFAULT_VARIANT_ID` (`'polyhedron'`).
- An unknown id throws `RangeError`; there is no silent fallback.
- `handle.variant` reports the resolved variant id.
- `handle.params` is typed `GlyphParams | NcubeParams`; narrow on `handle.variant`
  (or `'dimension' in handle.params`) before reading variant-specific fields.

React uses the same variant ids as the core API:

```jsx
<Prismicon seed="maya" variant="ncube-5" state="working" />
```

Omit `variant` to use `DEFAULT_VARIANT_ID`. An unknown id throws `RangeError`
during render, so wrap user-supplied ids in an error boundary. Changing
`variant` remounts the glyph; changing `state` updates the existing glyph and
never remounts it. `index.d.ts` exports `BuiltInVariantId` so built-in ids
autocomplete while custom ids stay accepted as plain strings.

### N-cube family

Deterministic projected hypercubes drawn onto the same 100×100 plane as the
polyhedron: cube, tesseract, penteract and hexeract, each rendered in one of the
three finishes (shaded, two-tone, wireframe) with a seed-derived rest orientation.

- `ncube` derives the dimension from the seed (3 to `NCUBE_MAX_DIMENSION`).
- `ncube-<d>` fixes the dimension. For a given seed, `ncube-<d>` differs from
  `ncube` **only** in `dimension`; every other param (finish, angles, hues) is
  identical, so `ncube-4` for a seed equals `ncube` whenever that seed derives 4.
- The aria label reads `"<seed>: <d>-cube (<name>), <finish>"`, e.g.
  `maya: 3-cube (cube), shaded`.

**Motion model.** Every state starts from the seed's rest orientation (so the
first mounted frame equals the static portrait) and follows the same lifecycle
as the polyhedron in `## States`, expressed as rotations of the 3D angles
(`ax`, `ay`, `az`) and the plane angles `theta[k]` (plane `k + 3`):

| State | N-cube motion |
|---|---|
| `idle`, `done`, `error` | none — the engine drives the flash; the pose is returned unchanged |
| `working` | highest plane `theta[d-4]` rotates at `dir · hyperSpeed`; each lower plane follows at `0.4^(top - i)` of that speed (the cascade); the seed's `spinAxis` drifts at `spin3` while the other two 3D angles ease to rest |
| `waiting` | gentle sway of `ax`/`ay` around rest; planes ease to rest |
| `thinking` | slow precessing wobble with a periodic nod on `ax`/`ay`; for d ≥ 4 the highest plane adds a slow hyper-wobble (±0.12 rad) |
| `sending` / `receiving` | burst on the highest plane (`3.2 × hyperSpeed`, decaying with `exp(−7·t)`), sending forward and receiving backward; then settles |
| `sleeping` | very slow bob of `ax`, dimmed |
| settling (after transient states) | every angle eases to rest and the pose snaps to the exact rest object once all are within 0.015 rad |

- **Highest-plane rule.** Only planes up to the instance's highest plane move;
  `theta[i]` for `i > d - 4` stays at rest, so a 4-cube rotates one plane, a
  5-cube two (the second at 40 % speed), a 6-cube three.
- **d = 3.** A cube has no plane angles: in `working` it spins on `spinAxis` at
  `spin3` (faster than the 4+ drift, since it is the cube's only motion) and the
  send/receive bursts apply to that axis instead.
- **Traits without new draws.** `dir`, `hyperSpeed`, `spinAxis`, `spin3`, `phase`
  and `phase2` are derived by `prepare` from disjoint bit ranges of `params.hash`
  and the existing `ax`/`ay` angles — no extra PRNG draws, so `deriveNcube`
  output and the static portrait are unchanged and the spec stays `ncube-v1`.
  `hyperSpeed` is `0.55–0.90 rad/s` at d = 4, slowed by `1 / (1 + 0.25·(d − 4))`
  above; `spin3` is `±0.22 rad/s` for d ≥ 4 and `±0.45–0.85 rad/s` for a cube.
  These constants are tunable, non-identity values (`MOTION_*` in
  `src/variants/ncube.js`). `GlyphHandle.params` exposes them; they are optional
  on `NcubeParams`.
- **Reduced motion.** Under `prefers-reduced-motion` the engine queues no frames,
  so a mounted n-cube equals its static markup in every state (only the ring and
  the dimming change).

**Derivation spec `ncube-v1` (frozen).** `seed → normalizeSeed → cyrb53 → mulberry32`,
then draws in this order:

1. `dimension = 3 + floor(r() * (NCUBE_MAX_DIMENSION - 3 + 1))` — always drawn,
   even for `ncube-<d>`, which then overrides the value.
2. `finish = floor(r() * 3)` (shaded, two-tone, wireframe).
3. `theta[k]` for axes `3 … NCUBE_MAX_DIMENSION - 1`, each `r() * TAU` — always
   `NCUBE_MAX_DIMENSION - 3` draws regardless of the instance's dimension.
4. `ax, ay, az` — the 3D rest orientation, each `r() * TAU`.
5. `hue = PALETTE[hash % 12]`, `hue2 = PALETTE[(idx + 4) % 12]` (not PRNG draws).

`NCUBE_MAX_DIMENSION = 6` is frozen with the spec: raising it changes the
`dimension` draw and the `theta` count and therefore requires `ncube-v2`.

**Support table.** The bound was measured with `scripts/measure-ncube.mjs`
(static SVG at size 64, five seeds, 200 `paint()` calls on Node 22). A dimension
is supported when, for every finish, the static SVG is ≤ 32768 bytes, the median
projected edge is ≥ 2.5 viewBox units and the median `paint()` takes ≤ 5 ms. The
"median frame ms" column is the animated `animate + paint` cost per frame from the
same script's frame benchmark (60 working frames at 30 fps, a send burst, then
settling; gate median ≤ 2 ms, p95 ≤ 4 ms, settling ≤ 60 frames). Both timing
columns come from the single 2026-09-12 run recorded in
`features/2026/09/ncube-motion-system/evidence/ncube-motion-frames.txt`:

| d | vertices | edges | faces | max bytes (shaded / wireframe) | median edge | median paint ms (shaded) | median frame ms (shaded) | supported |
|---|----------|-------|-------|--------------------------------|-------------|--------------------------|--------------------------|-----------|
| 3 | 8 | 12 | 6 | 845 / 517 | 25.39 | 0.020 | 0.014 | yes |
| 4 | 16 | 32 | 24 | 2779 / 960 | 15.72 | 0.049 | 0.033 | yes |
| 5 | 32 | 80 | 80 | 8771 / 2018 | 10.60 | 0.095 | 0.079 | yes |
| 6 | 64 | 192 | 240 | 25890 / 4479 | 7.29 | 0.229 | 0.227 | yes |
| 7 | 128 | 448 | 672 | 72115 / 10114 | 5.29 | 0.752 | — | no (bytes) |
| 8 | 256 | 1024 | 1792 | 191954 / 22785 | 3.53 | 2.223 | — | no (bytes) |
| 9 | 512 | 2304 | 4608 | 493266 / 50943 | 2.27 | 6.696 | — | no (all three) |

Dimensions above 6 are not registered; requesting `ncube-7` throws `RangeError`
like any unknown id.

## Custom variants

You can add your own visual style without touching package internals. A variant is
a plain descriptor object; `createPrismicon` builds a renderer for the built-ins plus
your descriptors, and `PrismiconProvider` makes that renderer available to React.
Callers that use none of this keep byte-identical output.

```js
import { createPrismicon, defineVariant, validateVariant } from 'prismicon';
```

### The descriptor contract

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Must match `VARIANT_ID_PATTERN` (`/^[a-z][a-z0-9-]*$/`) and be unique in its registry. |
| `label` | `string` | Human-readable name returned by `listVariants()`. |
| `spec` | `string` | Names the derivation spec your seed→params mapping is frozen under. Bump it whenever `derive` changes what a seed maps to, exactly as the built-ins use `v1` / `ncube-v1`. |

Plus the eight hooks, all required, all pure functions of their arguments:

| Hook | Signature | When the engine calls it |
|---|---|---|
| `derive` | `(seed) → params` | Once per render or mount, with the raw seed string. |
| `describe` | `(params) → string` | Once per render or mount, for the accessible `<title>`/`aria-label`; must be non-empty. |
| `prepare` | `(params, { size }) → params` | Once per render or mount, after `derive`, with the pixel size. |
| `geometry` | `(params) → geometry` | Once per render or mount, after `prepare`; reused for every frame. |
| `pose` | `(params, state) → pose` | For the rest pose of a state: `'idle'` for static renders, and on every `setState`. `state` may also be the internal `'settling'`. |
| `animate` | `(pose, ctx) → pose` | Once per animation frame while motion is enabled. `ctx` is `{ params, state, dt, t, transientT, rest }` (seconds). Return a **new** object; while `state === 'settling'`, return `ctx.rest` to signal motion has finished. |
| `paint` | `(params, geometry, pose, effects) → string` | Every static render and every frame. Returns the inner SVG markup for a 100×100 viewBox. `effects` is `{ dark, sleeping, dx, lighten, flash }`; `effects.dark` is `undefined` when a `renderStaticSVG` caller omits `dark` (mounted glyphs always pass a boolean), so treat it as falsy rather than comparing it to `false`. |
| `flash` | `(params, state) → { hue?, lighten?, shake? } \| null` | On each state transition. `lighten` is the peak lightness boost in percentage points; the engine scales it by the flash envelope and passes it to `paint` as `effects.lighten`. `validateVariant` also calls it with the internal `'settling'` state, so return `null` (or a valid object) for unknown states. |

**Reduced motion.** When `prefers-reduced-motion` is set, `animate` is never called and
`pose(params, state)` is painted as-is, so your idle `paint` output *is* the variant's
reduced-motion appearance. Make it a good portrait.

`defineVariant(descriptor)` runs the shape check only (known keys, id pattern,
non-empty `label`/`spec`, eight functions) and returns a frozen copy. Use it at module
scope when you export a variant, as the example below does.

### Validating a variant

```js
const myVariant = validateVariant(descriptor); // returns the frozen descriptor
```

`validateVariant(descriptor, { seeds?, size?, states? })` runs `defineVariant` and then
two smoke probes over five fixed seeds (override with `seeds`), both `dark` values, and
every state plus `'settling'`:

- **Determinism** — the full pipeline (`derive → prepare → geometry → pose → paint`,
  plus `flash` and one `animate` step per state) runs twice and every params, geometry,
  pose and flash object must `JSON.stringify` identically and every `paint` string must
  be strictly equal. This catches `Math.random`, `Date.now` and hidden mutable state.
- **SSR safety** — the static pipeline (`derive → describe → prepare → geometry →
  pose('idle') → paint`) runs while `window`, `document`, `navigator`, `matchMedia`,
  `requestAnimationFrame`, `cancelAnimationFrame`, `localStorage`, `sessionStorage` and
  `IntersectionObserver` are replaced by throwing getters. The original property
  descriptors are restored in `finally`, even when a probe fails. `typeof window`
  guards also fail the probe — static-path hooks must not read browser globals at
  all, because an environment-dependent branch would make server and client output
  disagree.

The probes also enforce the output contract they need to compare results: `derive`,
`prepare`, `geometry`, `pose` and `animate` return objects, `describe` returns a
non-empty string, `paint` returns a string, `flash` returns `null` or a plain object
with only `hue` (number), `lighten` (number) and `shake` (boolean).

Every failure is a `TypeError` whose message starts with `Variant "<id>"` and names the
probe and hook, e.g. `Variant "square" failed the determinism probe: hook "paint"
returned different output for seed "maya" (dark: false, state: "working")` or
`Variant "square" hook "derive" accessed browser global "window" during static
rendering`. Two identical runs cannot prove determinism; freeze goldens for anything
you ship, the way `scripts/generate-golden.mjs` does for the built-ins.

### `createPrismicon`

```js
import { createPrismicon } from 'prismicon';
import { square } from './square-variant.js';

// Module scope: one registry for the app's lifetime.
export const prismicon = createPrismicon({ variants: [square] });

prismicon.listVariants().map((v) => v.id);
// → ['polyhedron', 'ncube', 'ncube-3', 'ncube-4', 'ncube-5', 'ncube-6', 'square']
prismicon.renderStaticSVG('maya', { variant: 'square' });
const handle = prismicon.mountGlyph(el, 'maya', { variant: 'square', state: 'working' });
```

Options:

| Option | Default | Meaning |
|---|---|---|
| `variants` | `[]` | Array of descriptors to register after the built-ins. Non-arrays throw `TypeError`. |
| `defaultId` | `DEFAULT_VARIANT_ID` | Id resolved when `variant` is omitted. Must be registered. |
| `builtIns` | `true` | Include the built-in variants. With `false`, `defaultId` must name one of your `variants`. |
| `validate` | `true` | Run `validateVariant` on each descriptor. `false` keeps only the shape check (for example when you already validate at build time). |

Ids must be unique: registering two descriptors with the same id, or one whose id
shadows a built-in (`'polyhedron'`, `'ncube-4'`, …), throws
`TypeError: Duplicate prismicon variant id "…"`. Use `builtIns: false` when you want
a registry containing only your own variants.

The instance is frozen: `{ registry, renderStaticSVG, mountGlyph, listVariants }`.
`renderStaticSVG` and `mountGlyph` have the same signatures as the root exports and
resolve `variant` against `registry`; for every built-in id they produce byte-identical
output to the root exports. Calling `createPrismicon` never mutates the module-level
registry, so several instances coexist and share only the animation loop. Hoist the
call to module scope so `registry` keeps a stable identity — the React provider
remounts glyphs when it changes.

### React: `PrismiconProvider`

```jsx
import { Prismicon, PrismiconProvider } from 'prismicon/react';
import { prismicon } from './prismicon.js'; // createPrismicon({ variants: [square] })

export function App() {
  return (
    <PrismiconProvider registry={prismicon.registry}>
      <Prismicon seed="maya" variant="square" state="working" />
    </PrismiconProvider>
  );
}
```

`<Prismicon>` resolves `variant` against the nearest provider's `registry`; without a
provider it uses the built-ins, so existing trees are unaffected. Server rendering
inside the provider produces the same markup as `prismicon.renderStaticSVG`. Nested
providers work like any React context: the innermost registry wins. Replacing the
`registry` prop with a different object remounts every glyph below the provider
(their `state` is preserved via props), and passing anything that is not a registry
throws `TypeError` during render. Keep the registry at module scope; do not create it
inline in JSX. `PrismiconProviderProps` and `VariantRegistry` are exported from
`index.d.ts`.

### Example: a spinning square

`demo/square-variant.js` is the complete example, and it is the variant the package's
own dispatch tests run against. Excerpt:

```js
import { defineVariant } from 'prismicon';

export const SPEC_VERSION = 'test-square-1';

export function derive(seed) {
  const norm = String(seed).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < norm.length; i++) hash = ((hash << 5) - hash) + norm.charCodeAt(i);
  return { spec: SPEC_VERSION, seed: norm, hue: 60 + (Math.abs(hash) % 300) };
}

export function pose(params, state) {
  if (state === 'working') return { angle: (params.seed.length * 17) % 360 };
  return { angle: 0 };
}

export function animate(pose, ctx) {
  const { state, dt, rest } = ctx;
  if (state === 'working') return { angle: (pose.angle + 90 * dt) % 360 };
  if (state === 'settling') {
    const diff = ((rest.angle - pose.angle + 540) % 360) - 180;
    if (Math.abs(diff) < 0.5) return rest;
    return { angle: (pose.angle + diff * Math.min(1, dt * 4) + 360) % 360 };
  }
  return pose;
}

export function paint(params, geometry, pose) {
  const half = geometry.side / 2;
  return `<rect x="${50 - half}" y="${50 - half}" width="${geometry.side}" height="${geometry.side}"
    fill="hsl(${params.hue} 70% 50%)" stroke="black" stroke-width="${params.stroke}"
    transform="rotate(${pose.angle.toFixed(1)} 50 50)"/>`;
}

export const square = defineVariant({
  id: 'square', label: 'Square', spec: SPEC_VERSION,
  derive, describe, prepare, geometry, pose, animate, paint, flash
});
```

`demo/index.html` registers it with `createPrismicon({ variants: [square] })` and shows
it at `idle`, `working` and `done` under **Custom variant**.

## Adding a variant (maintainers)

Built-in variants ship inside the package and are frozen by golden fixtures, so adding
one is a documented, machine-checked recipe rather than a one-off:

1. Write `src/variants/<id>.js` with `defineVariant({ id, label, spec, … })` and export the
   descriptor. Pick a fresh `spec` string (e.g. `'<family>-v1'`) — it names the frozen
   derivation for this family.
2. Register it in `src/variants/index.js` by adding it to the `BUILT_IN_VARIANTS`
   registry and re-exporting it from `src/index.js`.
3. If it starts a new family, map its ids to a fixture file in `fixtureFor` in
   `test/helpers/golden.js` (`golden-<family>-v1.json`). Ids of an existing family
   (e.g. a new `ncube-N`) need no mapping change.
4. Run `node scripts/generate-golden.mjs`. It iterates every registered id, so the new
   variant gets a golden entry in its family file; existing entries are re-captured and
   must not change.
5. Add the id to `BuiltInVariantId` in `index.d.ts` and document it under `## Variants`.
6. Run `npm run check:variants` (or `npm run verify`, which also runs `npm test`).

`npm run check:variants` runs `scripts/check-variants.mjs`, which stops at the first
failing group and prints `✗ <check>: <reason>`; on success it prints one `✓` per check:

| Check | Verifies | Typical failure |
|-------|----------|-----------------|
| `contract` | `validateVariant` accepts every registered descriptor; `listVariants()` matches `BUILT_IN_VARIANTS.ids`; the default id is registered. | `TypeError` naming the id and the hook or probe that broke. |
| `exports` | `src/index.js` / `src/react.js` export exactly the pinned public names; `package.json` `exports`, `files`, `sideEffects: false`, no `bin`. | A public name was added or removed without updating the pinned list (or `index.d.ts`). |
| `types` | `tsc --noEmit --strict` over `index.d.ts` exits 0. | A declaration drifted from the runtime. |
| `pack` | `npm pack --dry-run` publishes only `src/**`, `index.d.ts`, `README.md`, `LICENSE`, `package.json` — nothing from `test/`, `scripts/`, `demo/`, `.github/`. | `files` in `package.json` was widened. |
| `goldens` | For the default and every other registered id, `captureGolden({ variant })` deep-equals its fixture entry. | `variant '<id>' has no golden entry` or `golden … is stale`; both say `regenerate with: node scripts/generate-golden.mjs`. |

**Spec-bump rule.** A golden may only change when its `spec` changes. If a variant's
identities must move (a draw is inserted, removed or reordered; a geometry constant like
`NCUBE_MAX_DIMENSION` is raised), bump the descriptor's `spec` (`ncube-v1` → `ncube-v2`),
map the new spec to a **new** fixture file in `fixtureFor`, and regenerate — never
overwrite an existing `*-v1.json`. A "stale" `goldens` failure without a spec bump is a
regression, not a fixture to refresh.

**CI.** `.github/workflows/ci.yml` runs `npm ci`, `npm test` and `npm run check:variants`
on every pull request and on pushes to `main`, so a registered variant without a golden,
a broken descriptor, a type drift or a leaking tarball fails the PR.

## Derivation spec v1 (frozen)

Identity must be stable across releases, so the derivation is versioned and frozen:

1. Seeds are normalized: trimmed and lowercased. `Alice@X.com` and `alice@x.com` are the same identity.
2. The normalized seed is hashed with cyrb53 and the hash seeds a mulberry32 PRNG.
3. Parameters are drawn in a fixed, documented order (see `src/core.js`). Inserting, removing, or reordering a draw is a breaking change and requires a new spec version.

Static identity dimensions: 4 side counts × 4 solid types × 3 finishes × 2 proportions × 12 curated hues ≈ 1,150 statically distinguishable identities; motion parameters (axis, tumble, tempo, direction, phase) add texture on top.

**Privacy note:** if seeds are emails or other cross-site identifiers, hash a per-app salt together with the seed before passing it in, so your identicons can't be correlated across services.

## Performance

- One shared `requestAnimationFrame` loop for all glyphs, throttled to 30 fps; the loop stops entirely when no glyphs are mounted.
- Idle and `user` glyphs render nothing after first paint.
- Offscreen glyphs pause via `IntersectionObserver`.
- `prefers-reduced-motion` renders every glyph as its static portrait (persistent rings still shown).

## License

MIT
