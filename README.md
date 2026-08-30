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

The ring patterns (solid / dashed / dotted) carry the status without color, so the states remain distinguishable for colorblind users and in grayscale. `aria-label` on each glyph announces identity and state and updates live.

`waiting` means blocked on something external (approval, input, an upstream dependency) — it keeps a ring because it needs a human's attention. `working` means busy internally. Keeping that distinction honest keeps your dashboard honest.

## React API

```jsx
<Prismicon
  seed="build-bot-7"   // required — any string; identity derives from it
  size={64}            // px, default 64
  kind="agent"         // 'agent' | 'user', default 'agent'
  state="working"      // GlyphState, default 'idle' (ignored for kind='user')
  dark={isDarkMode}    // optional; defaults to prefers-color-scheme
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
handle.destroy();

renderStaticSVG('maya', { size: 32, kind: 'user' }); // → '<svg …>'

const p = deriveV1('maya');
describeParams(p); // → 'pentagon bipyramid, two-tone, tall'
```

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
