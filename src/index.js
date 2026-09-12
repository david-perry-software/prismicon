export {
  SPEC_VERSION,
  STATES,
  PALETTE,
  SIDE_NAMES,
  SOLID_NAMES,
  FINISH_NAMES,
  normalizeSeed,
  deriveV1,
  describeParams,
  renderStaticSVG,
  mountGlyph
} from './core.js';

export {
  DEFAULT_VARIANT_ID,
  VARIANT_ID_PATTERN,
  createVariantRegistry,
  defineVariant,
  listVariants,
  validateVariant
} from './variants/index.js';
export { createPrismicon } from './authoring.js';
