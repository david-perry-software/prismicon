import { createVariantRegistry } from './registry.js';
import {
  describeParams,
  deriveV1,
  renderStaticSVG,
  mountGlyph,
  SPEC_VERSION
} from '../core.js';

export { VARIANT_ID_PATTERN, createVariantRegistry, defineVariant } from './registry.js';

export const DEFAULT_VARIANT_ID = 'polyhedron';

// Temporary old-shape descriptor so wave-1 registry tests stay valid while the
// polyhedron implementation moves into src/variants/polyhedron.js.
export const polyhedron = {
  id: 'polyhedron',
  label: 'Polyhedron',
  spec: SPEC_VERSION,
  derive: deriveV1,
  describe: describeParams,
  renderStatic: renderStaticSVG,
  mount: mountGlyph
};

/** Immutable registry of built-in variants; no import-time registration side effects. */
export const BUILT_IN_VARIANTS = createVariantRegistry([polyhedron], { defaultId: DEFAULT_VARIANT_ID });

/**
 * Per-icon selection: resolve the reserved `variant` option key to a descriptor.
 * @param {string | null | undefined} key
 * @param {import('./registry.js').VariantRegistry} [registry]
 */
export function resolveVariant(key, registry = BUILT_IN_VARIANTS) {
  return registry.resolve(key);
}
