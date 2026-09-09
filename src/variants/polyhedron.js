import {
  SPEC_VERSION,
  deriveV1,
  describeParams,
  mountGlyph,
  renderStaticSVG
} from '../core.js';
import { defineVariant } from './registry.js';

/**
 * Built-in default variant: the frozen v1 polyhedron engine. Binds the
 * existing core exports directly so default output stays byte-identical.
 */
export const polyhedron = defineVariant({
  id: 'polyhedron',
  label: 'Polyhedron',
  spec: SPEC_VERSION,
  derive: deriveV1,
  describe: describeParams,
  renderStatic: renderStaticSVG,
  mount: mountGlyph
});
