import { createVariantRegistry } from './registry.js';
import { polyhedron } from './polyhedron.js';

export { VARIANT_ID_PATTERN, createVariantRegistry, defineVariant } from './registry.js';

export const DEFAULT_VARIANT_ID = 'polyhedron';

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
