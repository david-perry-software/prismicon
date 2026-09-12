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

import { createContext, createElement as h, memo, useContext, useEffect, useMemo, useRef } from 'react';
import { createRenderer, renderStaticSVG, mountGlyph } from './core.js';
import { BUILT_IN_VARIANTS } from './variants/index.js';

const PrismiconRegistryContext = createContext(null);

// Without a provider the component uses the module-level pair bound to the built-ins.
const DEFAULT_CONTEXT = Object.freeze({ registry: BUILT_IN_VARIANTS, renderStaticSVG, mountGlyph });

function isVariantRegistry(value) {
  return value !== null && typeof value === 'object' &&
    typeof value.resolve === 'function' && typeof value.get === 'function' && Array.isArray(value.ids);
}

/**
 * Makes a custom registry (e.g. `createPrismicon({ variants }).registry`) available
 * to every `<Prismicon>` below it. Hoist the registry to module scope: the provider
 * memoises its renderer on registry identity and glyphs remount when it changes.
 */
export function PrismiconProvider({ registry, children }) {
  if (!isVariantRegistry(registry)) {
    throw new TypeError('PrismiconProvider "registry" must be a variant registry');
  }
  const value = useMemo(() => Object.freeze({ registry, ...createRenderer(registry) }), [registry]);
  return h(PrismiconRegistryContext.Provider, { value }, children);
}

const GlyphHost = memo(function GlyphHost({ hostRef, className, title, style, markup }) {
  return h('span', {
    ref: hostRef,
    className,
    title,
    style: { display: 'inline-block', lineHeight: 0, ...style },
    dangerouslySetInnerHTML: { __html: markup }
  });
});

export function Prismicon(props) {
  const {
    seed,
    size = 64,
    kind = 'agent',
    state = 'idle',
    dark,
    variant,
    className,
    style,
    title
  } = props;

  const ctx = useContext(PrismiconRegistryContext) || DEFAULT_CONTEXT;
  ctx.registry.resolve(variant);

  const ref = useRef(null);
  const handle = useRef(null);
  const initialMarkup = useRef(null);
  if (initialMarkup.current === null) {
    initialMarkup.current = ctx.renderStaticSVG(seed, { size, kind, state, dark, variant });
  }

  useEffect(() => {
    if (!ref.current) return undefined;
    handle.current = ctx.mountGlyph(ref.current, seed, { kind, size, dark, state, variant });
    return () => {
      if (handle.current) handle.current.destroy();
      handle.current = null;
    };
    // Remount when identity, geometry-affecting props, or the providing registry change.
  }, [seed, size, kind, dark, variant, ctx]);

  useEffect(() => {
    if (handle.current) handle.current.setState(state);
  }, [state]);

  return h(GlyphHost, {
    hostRef: ref,
    className,
    title,
    style,
    // Static portrait for SSR and first paint; mountGlyph replaces it on hydrate.
    markup: initialMarkup.current
  });
}

export default Prismicon;
