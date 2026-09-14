import { createVariantRegistry } from './registry.js';
import { polyhedron } from './polyhedron.js';
import { ncubeVariants } from './ncube.js';
import { orbit } from './orbit.js';

export { VARIANT_ID_PATTERN, createVariantRegistry, defineVariant } from './registry.js';
export { validateVariant } from './validate.js';
export { polyhedron } from './polyhedron.js';
export { ncube, ncubeVariants, NCUBE_MIN_DIMENSION, NCUBE_MAX_DIMENSION, NCUBE_SPEC_VERSION } from './ncube.js';
export { orbit, ORBIT_SPEC_VERSION } from './orbit.js';

export const DEFAULT_VARIANT_ID = 'polyhedron';

/** Immutable registry of built-in variants; no import-time registration side effects. */
export const BUILT_IN_VARIANTS = createVariantRegistry([polyhedron, ...ncubeVariants, orbit], { defaultId: DEFAULT_VARIANT_ID });

/**
 * Per-icon selection: resolve the reserved `variant` option key to a descriptor.
 * @param {string | null | undefined} key
 * @param {import('./registry.js').VariantRegistry} [registry]
 */
export function resolveVariant(key, registry = BUILT_IN_VARIANTS) {
  return registry.resolve(key);
}

/**
 * List registered variants without exposing their internal hooks.
 * @param {import('./registry.js').VariantRegistry} [registry]
 * @returns {ReadonlyArray<Readonly<{ id: string; label: string; spec: string }>>}
 */
export function listVariants(registry = BUILT_IN_VARIANTS) {
  return Object.freeze(registry.ids.map((id) => {
    const { label, spec } = registry.get(id);
    return Object.freeze({ id, label, spec });
  }));
}
