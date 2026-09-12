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
- Motion is deliberately static in this release: `pose` returns the seed-derived
  rest orientation for every state and `animate` settles immediately. State-aware
  motion arrives with the `ncube-motion-system` feature; lifecycle flashes
  (`receiving`, `done`, `error`) already work.

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
projected edge is ≥ 2.5 viewBox units and the median `paint()` takes ≤ 5 ms:

| d | vertices | edges | faces | max bytes (shaded / wireframe) | median edge | median paint ms (shaded) | supported |
|---|----------|-------|-------|--------------------------------|-------------|--------------------------|-----------|
| 3 | 8 | 12 | 6 | 845 / 517 | 25.39 | 0.041 | yes |
| 4 | 16 | 32 | 24 | 2779 / 960 | 15.72 | 0.059 | yes |
| 5 | 32 | 80 | 80 | 8771 / 2018 | 10.60 | 0.135 | yes |
| 6 | 64 | 192 | 240 | 25890 / 4479 | 7.29 | 0.370 | yes |
| 7 | 128 | 448 | 672 | 72115 / 10114 | 5.29 | 0.863 | no (bytes) |
| 8 | 256 | 1024 | 1792 | 191954 / 22785 | 3.53 | 3.040 | no (bytes) |
| 9 | 512 | 2304 | 4608 | 493266 / 50943 | 2.27 | 10.680 | no (all three) |

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
| `paint` | `(params, geometry, pose, effects) → string` | Every static render and every frame. Returns the inner SVG markup for a 100×100 viewBox. `effects` is `{ dark, sleeping, dx, lighten, flash }`. |
| `flash` | `(params, state) → { hue?, lighten?, shake? } \| null` | On each state transition. `lighten` is the peak lightness boost in percentage points; the engine scales it by the flash envelope and passes it to `paint` as `effects.lighten`. |

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
