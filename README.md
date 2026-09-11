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
