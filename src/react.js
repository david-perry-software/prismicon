'use client';

/**
 * prismicon React binding.
 *
 * Written with React.createElement (no JSX) so the package needs no build
 * step and works when imported directly from node_modules in Next.js.
 *
 * Server render: static portrait SVG (deterministic, no flash of empty).
 * Client: hydrates into a live glyph driven by the shared animation engine.
 */

import { createElement as h, useEffect, useRef } from 'react';
import { renderStaticSVG, mountGlyph } from './core.js';

export function Prismicon(props) {
  const {
    seed,
    size = 64,
    kind = 'agent',
    state = 'idle',
    dark,
    className,
    style,
    title
  } = props;

  const ref = useRef(null);
  const handle = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    handle.current = mountGlyph(ref.current, seed, { kind, size, dark, state });
    return () => {
      if (handle.current) handle.current.destroy();
      handle.current = null;
    };
    // Remount when identity or geometry-affecting props change.
  }, [seed, size, kind, dark]);

  useEffect(() => {
    if (handle.current) handle.current.setState(state);
  }, [state]);

  return h('span', {
    ref,
    className,
    title,
    style: { display: 'inline-block', lineHeight: 0, ...style },
    // Static portrait for SSR and first paint; mountGlyph replaces it on hydrate.
    dangerouslySetInnerHTML: {
      __html: renderStaticSVG(seed, { size, kind, state, dark })
    }
  });
}

export default Prismicon;
