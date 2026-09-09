/**
 * prismicon variants — descriptor contract and registry.
 *
 * A variant is one complete visual style: a frozen descriptor binding an id to
 * the seven narrow pipeline hooks consumed by the shared renderer:
 *
 *   derive(seed) -> params
 *   describe(params) -> string
 *   prepare(params, { size }) -> params
 *   geometry(params) -> immutable geometry
 *   pose(params, state) -> immutable pose
 *   animate(pose, ctx) -> new immutable pose
 *   paint(params, geometry, pose, effects) -> SVG markup string
 *   flash(params, state) -> { hue?, lighten?, shake? } | null
 *
 * The shared renderer calls them in that order. `geometry` is computed once
 * per instance; `pose` is the rest/target configuration for a state; `animate`
 * is invoked each animation frame. When the engine is in the `settling` state,
 * returning `ctx.rest` from `animate` signals that motion has finished and the
 * engine should switch back to `idle`. All pose objects are treated as
 * immutable — `animate` must return a new object rather than mutating the
 * input.
 *
 * `ctx` passed to `animate` contains:
 *   params, state, dt (seconds), t (seconds), transientT, rest
 *
 * `effects` passed to `paint` contains:
 *   dark, sleeping, dx, lighten, flash: { hue?, strength }
 *
 * This module imports nothing from the rendering engine so a dispatcher can
 * depend on it without creating an import cycle.
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

const HOOK_NAMES = ['derive', 'describe', 'prepare', 'geometry', 'pose', 'animate', 'paint', 'flash'];
const STRING_FIELDS = ['label', 'spec'];
const KNOWN_KEYS = new Set(['id', ...STRING_FIELDS, ...HOOK_NAMES]);

/**
 * @typedef {object} VariantDescriptor
 * @property {string} id            Matches VARIANT_ID_PATTERN.
 * @property {string} label         Human-readable name.
 * @property {string} spec          Derivation spec version the identities are frozen under.
 * @property {(seed: string) => object} derive
 * @property {(params: object) => string} describe
 * @property {(params: object, ctx: { size: number }) => object} prepare
 * @property {(params: object) => object} geometry
 * @property {(params: object, state: string) => object} pose
 * @property {(pose: object, ctx: { params: object, state: string, dt: number, t: number, transientT: number, rest: object }) => object} animate
 * @property {(params: object, geometry: object, pose: object, effects: object) => string} paint
 * @property {(params: object, state: string) => { hue?: number, lighten?: number, shake?: boolean } | null} flash
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

/**
 * @typedef {object} VariantRegistry
 * @property {ReadonlyArray<string>} ids       Registered ids in registration order.
 * @property {string} defaultId
 * @property {(id: string) => boolean} has
 * @property {(id: string) => Readonly<VariantDescriptor>} get      Unknown id → RangeError.
 * @property {(key?: string | null) => Readonly<VariantDescriptor>} resolve  Per-icon selection.
 */

/**
 * Build an immutable registry from descriptors. There is no mutation API:
 * adding a variant means creating a new registry from a longer list.
 * @param {VariantDescriptor[]} descriptors
 * @param {{ defaultId: string }} options
 * @returns {Readonly<VariantRegistry>}
 * @throws {TypeError} on duplicate ids or an unregistered defaultId
 */
export function createVariantRegistry(descriptors, { defaultId } = {}) {
  if (!Array.isArray(descriptors)) {
    throw new TypeError('Variant registry requires an array of descriptors');
  }
  const byId = new Map();
  for (const descriptor of descriptors) {
    const variant = defineVariant(descriptor);
    if (byId.has(variant.id)) {
      throw new TypeError(`Duplicate prismicon variant id "${variant.id}"`);
    }
    byId.set(variant.id, variant);
  }
  const ids = Object.freeze([...byId.keys()]);
  if (!byId.has(defaultId)) {
    throw new TypeError(`Default variant ${JSON.stringify(defaultId)} is not registered; registered: ${ids.join(', ')}`);
  }

  function has(id) {
    return byId.has(id);
  }

  function get(id) {
    const variant = byId.get(id);
    if (!variant) {
      throw new RangeError(`Unknown prismicon variant "${id}"; registered: ${ids.join(', ')}`);
    }
    return variant;
  }

  function resolve(key) {
    if (key === undefined || key === null) return byId.get(defaultId);
    if (typeof key !== 'string') {
      throw new TypeError(`Variant key must be a string; got ${typeof key}`);
    }
    return get(key);
  }

  return Object.freeze({ ids, defaultId, has, get, resolve });
}
