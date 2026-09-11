/**
 * prismicon variants — consumer-facing descriptor validation.
 *
 * `validateVariant` runs the shape check from `defineVariant` and then two
 * smoke probes over a fixed seed list:
 *
 *   - determinism: the full hook pipeline is run twice per seed and both runs
 *     must agree (catches `Math.random`, `Date.now`, hidden mutable state);
 *   - SSR safety: the static pipeline is run while browser globals are
 *     replaced by throwing getters, so a hook that reaches for `window` or
 *     `document` during a server render is reported by name.
 *
 * The output checks the probes need in order to compare results (`describe`
 * is a non-empty string, `paint` is a string, `flash` is null or a plain
 * `{ hue?, lighten?, shake? }` object, everything else is an object) are part
 * of the probes. Two identical runs cannot prove determinism; freeze goldens
 * for anything you ship.
 *
 * This module imports nothing from the rendering engine (`core.js` imports
 * `variants/index.js`), so the probed state list is a local constant that the
 * test suite pins to `[...STATES, 'settling']`.
 */

import { defineVariant } from './registry.js';

/** Engine states the probes exercise: every public state plus the internal `settling`. */
export const PROBE_STATES = Object.freeze([
  'idle', 'working', 'waiting', 'done', 'error', 'thinking', 'sending', 'receiving', 'sleeping', 'settling'
]);

const DEFAULT_SEEDS = Object.freeze(['maya', 'build-bot-7', 'Alice@X.com', 'Ada Lovelace', 'demo-agent']);
const DEFAULT_SIZE = 64;
const DARK_VALUES = Object.freeze([false, true]);
const ANIMATE_DT = 1 / 60;

const BROWSER_GLOBALS = Object.freeze([
  'window', 'document', 'navigator', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame',
  'localStorage', 'sessionStorage', 'IntersectionObserver'
]);

const FLASH_KEY_TYPES = Object.freeze({ hue: 'number', lighten: 'number', shake: 'boolean' });

const SSR_PROBE_TAG = Symbol('prismicon.ssr-probe');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(id, message) {
  return new TypeError(`Variant "${id}" ${message}`);
}

function show(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') return 'a function';
  if (Array.isArray(value)) return 'an array';
  return String(value);
}

/** Call one hook, translating SSR-probe hits and unexpected throws into named TypeErrors. */
function invoke(variant, hook, args) {
  try {
    return variant[hook](...args);
  } catch (error) {
    if (error !== null && typeof error === 'object' && SSR_PROBE_TAG in error) {
      throw fail(variant.id, `hook "${hook}" accessed browser global "${error[SSR_PROBE_TAG]}" during static rendering`);
    }
    const detail = error && error.message ? error.message : String(error);
    throw new TypeError(`Variant "${variant.id}" hook "${hook}" threw during validation: ${detail}`, { cause: error });
  }
}

function expectObject(id, hook, value) {
  if (!isPlainObject(value)) {
    throw fail(id, `hook "${hook}" must return an object; got ${show(value)}`);
  }
  return value;
}

function expectString(id, hook, value, { nonEmpty = false } = {}) {
  if (typeof value !== 'string' || (nonEmpty && value.length === 0)) {
    throw fail(id, `hook "${hook}" must return a ${nonEmpty ? 'non-empty ' : ''}string; got ${show(value)}`);
  }
  return value;
}

function expectFlash(id, value) {
  if (value === null) return value;
  if (!isPlainObject(value)) {
    throw fail(id, `hook "flash" must return null or a plain object with only "hue", "lighten", "shake"; got ${show(value)}`);
  }
  for (const key of Object.keys(value)) {
    const expected = FLASH_KEY_TYPES[key];
    if (!expected) {
      throw fail(id, `hook "flash" returned unknown key "${key}"; allowed: "hue", "lighten", "shake"`);
    }
    if (value[key] !== undefined && typeof value[key] !== expected) {
      throw fail(id, `hook "flash" key "${key}" must be a ${expected}; got ${show(value[key])}`);
    }
  }
  return value;
}

/** derive → describe → prepare → geometry → pose('idle') → paint: what a server render calls. */
function runStatic(variant, seed, size, dark) {
  const { id } = variant;
  const params = expectObject(id, 'derive', invoke(variant, 'derive', [seed]));
  const description = expectString(id, 'describe', invoke(variant, 'describe', [params]), { nonEmpty: true });
  const prepared = expectObject(id, 'prepare', invoke(variant, 'prepare', [params, { size }]));
  const geometry = expectObject(id, 'geometry', invoke(variant, 'geometry', [prepared]));
  const rest = expectObject(id, 'pose', invoke(variant, 'pose', [prepared, 'idle']));
  const effects = { dark, sleeping: false, dx: 0, lighten: 0, flash: null };
  const paint = expectString(id, 'paint', invoke(variant, 'paint', [prepared, geometry, rest, effects]));
  return { params, description, prepared, geometry, rest, paint };
}

/** The static pipeline plus every probed state's pose, paint, flash and one animate step. */
function runPipeline(variant, seed, size, states, dark) {
  const { id } = variant;
  const base = runStatic(variant, seed, size, dark);
  const { prepared, geometry, rest } = base;
  const perState = states.map((state) => {
    const pose = expectObject(id, 'pose', invoke(variant, 'pose', [prepared, state]));
    const effects = { dark, sleeping: state === 'sleeping', dx: 0, lighten: 0, flash: null };
    const paint = expectString(id, 'paint', invoke(variant, 'paint', [prepared, geometry, pose, effects]));
    const flash = expectFlash(id, invoke(variant, 'flash', [prepared, state]));
    const ctx = { params: prepared, state, dt: ANIMATE_DT, t: 0, transientT: 0, rest };
    const animated = expectObject(id, 'animate', invoke(variant, 'animate', [pose, ctx]));
    return { state, pose, paint, flash, animated };
  });
  return { ...base, perState };
}

function same(a, b) {
  return typeof a === 'string' ? a === b : JSON.stringify(a) === JSON.stringify(b);
}

function compareRuns(id, seed, dark, first, second) {
  const where = (extra = '') => `for seed ${JSON.stringify(seed)} (dark: ${dark}${extra})`;
  const differs = (hook, a, b, extra) => {
    if (!same(a, b)) {
      throw fail(id, `failed the determinism probe: hook "${hook}" returned different output ${where(extra)}`);
    }
  };
  differs('derive', first.params, second.params);
  differs('describe', first.description, second.description);
  differs('prepare', first.prepared, second.prepared);
  differs('geometry', first.geometry, second.geometry);
  differs('pose', first.rest, second.rest);
  differs('paint', first.paint, second.paint);
  first.perState.forEach((a, i) => {
    const b = second.perState[i];
    const extra = `, state ${JSON.stringify(a.state)}`;
    differs('pose', a.pose, b.pose, extra);
    differs('paint', a.paint, b.paint, extra);
    differs('flash', a.flash, b.flash, extra);
    differs('animate', a.animated, b.animated, extra);
  });
}

/** Run `fn` while every configurable browser global throws a tagged error on access; restore afterwards. */
function withBrowserGlobalsBlocked(fn) {
  const restore = [];
  try {
    for (const name of BROWSER_GLOBALS) {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
      if (descriptor && !descriptor.configurable) continue;
      const trap = () => {
        const error = new Error(`browser global "${name}" is unavailable during static rendering`);
        error[SSR_PROBE_TAG] = name;
        throw error;
      };
      Object.defineProperty(globalThis, name, {
        configurable: true,
        enumerable: descriptor ? descriptor.enumerable : false,
        get: trap,
        set: trap
      });
      restore.push([name, descriptor]);
    }
    return fn();
  } finally {
    for (const [name, descriptor] of restore.reverse()) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

function normalizeOptions({ seeds = DEFAULT_SEEDS, size = DEFAULT_SIZE, states = PROBE_STATES } = {}) {
  if (!Array.isArray(seeds) || seeds.length === 0 || !seeds.every((seed) => typeof seed === 'string')) {
    throw new TypeError('validateVariant "seeds" must be a non-empty array of strings');
  }
  if (typeof size !== 'number' || !(size > 0)) {
    throw new TypeError('validateVariant "size" must be a positive number');
  }
  if (!Array.isArray(states) || !states.every((state) => typeof state === 'string')) {
    throw new TypeError('validateVariant "states" must be an array of strings');
  }
  return { seeds, size, states };
}

/**
 * Validate a variant descriptor: shape, output contract, determinism and SSR safety.
 * Returns the frozen descriptor so `const v = validateVariant({ ... })` composes.
 * @param {import('./registry.js').VariantDescriptor} descriptor
 * @param {{ seeds?: string[], size?: number, states?: string[] }} [options]
 * @returns {Readonly<import('./registry.js').VariantDescriptor>}
 * @throws {TypeError} whose message starts with `Variant "<id>"` and names the probe and hook
 */
export function validateVariant(descriptor, options) {
  const { seeds, size, states } = normalizeOptions(options);
  const variant = defineVariant(descriptor);
  // SSR first: in plain Node a bare `window` reference is then reported by name instead of as a ReferenceError.
  withBrowserGlobalsBlocked(() => {
    for (const seed of seeds) runStatic(variant, seed, size, false);
  });
  for (const seed of seeds) {
    for (const dark of DARK_VALUES) {
      const first = runPipeline(variant, seed, size, states, dark);
      const second = runPipeline(variant, seed, size, states, dark);
      compareRuns(variant.id, seed, dark, first, second);
    }
  }
  return variant;
}
