/**
 * prismicon authoring — build a renderer bound to built-ins plus your own variants.
 *
 * `createPrismicon` never mutates the module-level registry: every call returns
 * a new frozen instance whose `renderStaticSVG` / `mountGlyph` / `listVariants`
 * see exactly the variants passed in. Instances share only the singleton
 * animation engine. Hoist the call to module scope so the registry identity is
 * stable (the React provider remounts glyphs when it changes).
 */

import { createRenderer } from './core.js';
import { BUILT_IN_VARIANTS, DEFAULT_VARIANT_ID, listVariants } from './variants/index.js';
import { createVariantRegistry } from './variants/registry.js';
import { validateVariant } from './variants/validate.js';

/**
 * @param {{
 *   variants?: import('./variants/registry.js').VariantDescriptor[],
 *   defaultId?: string,
 *   builtIns?: boolean,
 *   validate?: boolean
 * }} [options]
 * @returns {Readonly<{
 *   registry: import('./variants/registry.js').VariantRegistry,
 *   renderStaticSVG: typeof import('./core.js').renderStaticSVG,
 *   mountGlyph: typeof import('./core.js').mountGlyph,
 *   listVariants: () => ReturnType<typeof listVariants>
 * }>}
 * @throws {TypeError} on a non-array `variants`, a failed probe, a duplicate id
 *   (including shadowing a built-in) or an unregistered `defaultId`
 */
export function createPrismicon({
  variants = [],
  defaultId = DEFAULT_VARIANT_ID,
  builtIns = true,
  validate = true
} = {}) {
  if (!Array.isArray(variants)) {
    throw new TypeError('createPrismicon "variants" must be an array of variant descriptors');
  }
  const custom = validate ? variants.map((descriptor) => validateVariant(descriptor)) : variants;
  const base = builtIns ? BUILT_IN_VARIANTS.ids.map((id) => BUILT_IN_VARIANTS.get(id)) : [];
  const registry = createVariantRegistry([...base, ...custom], { defaultId });
  const { renderStaticSVG, mountGlyph } = createRenderer(registry);
  return Object.freeze({
    registry,
    renderStaticSVG,
    mountGlyph,
    listVariants: () => listVariants(registry)
  });
}
