/**
 * prismicon variants — descriptor contract and registry.
 *
 * A variant is one complete visual style: a frozen descriptor binding an id to
 * the four pipeline hooks (derive → describe → renderStatic / mount). This
 * module imports nothing from the rendering engine so a dispatcher can depend
 * on it without creating an import cycle.
 *
 * Per-icon selection (reserved, not read by this module): the option key
 * `variant` on GlyphOptions / PrismiconProps carries a registered id and is
 * resolved through `registry.resolve(key)`. Fallback rule: an absent key
 * (`undefined`/`null`) resolves to the registry default; an unknown id throws
 * RangeError — there is no silent fallback.
 *
 * `spec` names the derivation spec the variant's seed-derived identities are
 * frozen under; it must change whenever those identities change.
 */

/** Ids are stable, URL- and prop-safe tokens. */
export const VARIANT_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const HOOK_NAMES = ['derive', 'describe', 'renderStatic', 'mount'];
const STRING_FIELDS = ['label', 'spec'];
const KNOWN_KEYS = new Set(['id', ...STRING_FIELDS, ...HOOK_NAMES]);

/**
 * @typedef {object} VariantDescriptor
 * @property {string} id            Matches VARIANT_ID_PATTERN.
 * @property {string} label         Human-readable name.
 * @property {string} spec          Derivation spec version the identities are frozen under.
 * @property {(seed: string) => object} derive
 * @property {(params: object) => object} describe
 * @property {(seed: string, opts?: object) => string} renderStatic
 * @property {(el: Element, seed: string, opts?: object) => object} mount
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validate a variant descriptor and return a frozen copy.
 * @param {VariantDescriptor} descriptor
 * @returns {Readonly<VariantDescriptor>}
 * @throws {TypeError} naming the offending field
 */
export function defineVariant(descriptor) {
  if (descriptor === null || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError('Variant descriptor must be a plain object');
  }
  for (const key of Object.keys(descriptor)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new TypeError(`Variant descriptor has unknown key "${key}"`);
    }
  }
  const { id } = descriptor;
  if (typeof id !== 'string' || !VARIANT_ID_PATTERN.test(id)) {
    throw new TypeError(`Variant "id" must match ${VARIANT_ID_PATTERN}; got ${JSON.stringify(id)}`);
  }
  for (const field of STRING_FIELDS) {
    if (!isNonEmptyString(descriptor[field])) {
      throw new TypeError(`Variant "${id}" field "${field}" must be a non-empty string`);
    }
  }
  for (const hook of HOOK_NAMES) {
    if (typeof descriptor[hook] !== 'function') {
      throw new TypeError(`Variant "${id}" hook "${hook}" must be a function`);
    }
  }
  return Object.freeze({ ...descriptor });
}
