/**
 * prismicon core — shared rendering pipeline.
 *
 * This module owns the framework-agnostic machinery that every variant needs:
 * option normalization, the SVG shell, status rings, accessibility text,
 * reduced-motion handling, and the shared singleton animation engine. All
 * geometry, derivation, pose, motion, and painting lives in variant
 * descriptors (see `src/variants/polyhedron.js` for the frozen v1 default).
 */

import {
  SPEC_VERSION,
  PALETTE,
  SIDE_NAMES,
  SOLID_NAMES,
  FINISH_NAMES,
  normalizeSeed,
  deriveV1,
  describeParams,
  prepareParams,
  buildGeometry,
  poseForState,
  animatePose,
  paintFrame
} from './variants/polyhedron.js';

export const STATES = ['idle', 'working', 'waiting', 'done', 'error', 'thinking', 'sending', 'receiving', 'sleeping'];

export {
  SPEC_VERSION,
  PALETTE,
  SIDE_NAMES,
  SOLID_NAMES,
  FINISH_NAMES,
  normalizeSeed,
  deriveV1,
  describeParams
};

const STATUS_RING = {
  done:      { color: 'hsl(145 50% 42%)', dash: null,    cap: null },
  error:     { color: 'hsl(4 70% 50%)',   dash: '7 5',   cap: null },
  waiting:   { color: 'hsl(42 80% 44%)',  dash: '0.1 9', cap: 'round' },
  thinking:  { color: 'hsl(217 70% 55%)', dash: '12 7',  cap: null,   animation: 'prismicon-pulse 2.4s ease-in-out infinite', persistent: true },
  sending:   { color: 'hsl(210 70% 58%)', dash: null,    cap: null,   animation: 'prismicon-ripple-out 0.9s ease-out both' },
  receiving: { color: 'hsl(187 65% 50%)', dash: null,    cap: null,   animation: 'prismicon-ripple-in 0.9s ease-out both' }
};

const RING_FOR_STATE = {
  done: 'done', error: 'error', waiting: 'waiting',
  thinking: 'thinking', sending: 'sending', receiving: 'receiving'
};

// ---------------------------------------------------------------- shared SVG pieces

function ringMarkup(status, animate) {
  if (!status) return '';
  const st = STATUS_RING[status];
  const animation = st.persistent
    ? st.animation
    : (animate ? (st.animation || 'prismicon-sfade 0.5s ease 0.3s both') : null);
  return '<circle cx="50" cy="50" r="42" fill="none" stroke="' + st.color + '" stroke-width="4.5"' +
    (st.dash ? ' stroke-dasharray="' + st.dash + '"' : '') +
    (st.cap ? ' stroke-linecap="' + st.cap + '"' : '') +
    (animation ? ' style="animation:' + animation + '"' : '') + '/>';
}

function describeInstance(variant, seedRaw, p, kind, state) {
  let s = seedRaw + ': ' + variant.describe(p);
  if (kind === 'agent') s += ', ' + (state || 'idle');
  return s;
}

// ---------------------------------------------------------------- renderer factory

const polyhedron = {
  id: 'polyhedron',
  label: 'Polyhedron',
  spec: SPEC_VERSION,
  derive: deriveV1,
  describe: describeParams,
  prepare: prepareParams,
  geometry: buildGeometry,
  pose: poseForState,
  animate: animatePose,
  paint: paintFrame
};

const BUILT_IN_VARIANTS = {
  defaultId: 'polyhedron',
  resolve(key) {
    if (key === undefined || key === null) return polyhedron;
    if (key !== 'polyhedron') {
      throw new RangeError('Unknown prismicon variant "' + key + '"; registered: polyhedron');
    }
    return polyhedron;
  }
};

export function createRenderer(registry) {
  function renderStaticSVG(seed, opts = {}) {
    const variant = registry.resolve(opts.variant);
    const size = opts.size || 64;
    const kind = opts.kind || 'agent';
    const p = variant.prepare(variant.derive(seed), { size });
    const geo = variant.geometry(p);
    const rest = variant.pose(p, 'idle');
    const status = kind === 'agent' ? RING_FOR_STATE[opts.state] || null : null;
    const inner = variant.paint(p, geo, rest, { dark: opts.dark, sleeping: false, dx: 0, lighten: 0, flash: null });
    return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size +
      '" role="img" aria-label="' + describeInstance(variant, String(seed), p, kind, opts.state) + '">' +
      '<g>' + inner + '</g><g>' + ringMarkup(status, false) + '</g></svg>';
  }

  function mountGlyph(el, seed, opts = {}) {
    const eng = getEngine();
    const variant = registry.resolve(opts.variant);
    const kind = opts.kind || 'agent';
    const size = opts.size || 64;
    const dark = opts.dark != null ? !!opts.dark : autoDark();
    const p = variant.prepare(variant.derive(seed), { size });
    const geo = variant.geometry(p);
    const initial = kind === 'user' ? 'idle' : (opts.state || 'idle');
    el.classList.add('prismicon');
    el.innerHTML = '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size +
      '" role="img"><g></g><g></g></svg>';
    const svg = el.querySelector('svg');
    const gs = el.querySelectorAll('g');
    const rest = variant.pose(p, 'idle');
    const initialPose = !eng.reduced && initial === 'working' ? variant.pose(p, 'working') : rest;
    const inst = {
      svg, g: gs[0], sg: gs[1], variant, p, geo, kind, dark, seedRaw: String(seed),
      state: !eng.reduced && (initial === 'working' || initial === 'waiting' || initial === 'thinking' || initial === 'sleeping') ? initial : 'idle',
      rest, pose: initialPose,
      flash: null, flashT: 0, shake: false, transientT: 0, lightenFlash: false, visible: true,
      publicState: initial
    };
    inst.g.innerHTML = variant.paint(p, geo, inst.pose, { dark, sleeping: initial === 'sleeping', dx: 0, lighten: 0, flash: null });
    if (initial === 'sleeping') inst.g.setAttribute('opacity', '0.7');
    applyStatus(inst, initial, false);
    if (kind === 'agent' && !eng.reduced) {
      eng.instances.push(inst);
      if (eng.io) eng.io.observe(svg);
      eng.ensureRunning();
    }
    function applyStatus(target, stateName, animate) {
      const status = RING_FOR_STATE[stateName] || null;
      target.sg.innerHTML = ringMarkup(status, animate);
      target.svg.setAttribute('aria-label', describeInstance(target.variant, target.seedRaw, target.p, target.kind, stateName));
    }
    return {
      params: p,
      get variant() { return variant.id; },
      get state() { return inst.publicState; },
      setState(name) {
        if (kind !== 'agent' || STATES.indexOf(name) < 0) return;
        inst.publicState = name;
        if (eng.reduced) {
          inst.pose = inst.rest;
          inst.g.innerHTML = variant.paint(p, geo, inst.pose, { dark, sleeping: name === 'sleeping', dx: 0, lighten: 0, flash: null });
          if (name === 'sleeping') inst.g.setAttribute('opacity', '0.7');
          else inst.g.removeAttribute('opacity');
          applyStatus(inst, name, false);
          return;
        }
        if (name === 'working' || name === 'waiting' || name === 'thinking' || name === 'sleeping') {
          inst.state = name; inst.flash = null; inst.lightenFlash = false;
        } else if (name === 'sending' || name === 'receiving') {
          inst.state = name; inst.transientT = 0; inst.flashT = 0; inst.shake = false;
          if (name === 'receiving') { inst.flash = p.hue; inst.lightenFlash = true; }
          else { inst.flash = null; inst.lightenFlash = false; }
        } else {
          inst.state = 'settling'; inst.flashT = 0;
          if (name === 'done') { inst.flash = 145; inst.shake = false; }
          else if (name === 'error') { inst.flash = 4; inst.shake = true; }
          else { inst.flash = null; }
          inst.lightenFlash = false;
        }
        applyStatus(inst, name, true);
        eng.ensureRunning();
      },
      destroy() {
        const i = eng.instances.indexOf(inst);
        if (i >= 0) eng.instances.splice(i, 1);
        if (eng.io) eng.io.unobserve(svg);
        el.innerHTML = '';
        el.classList.remove('prismicon');
      }
    };
  }

  return { renderStaticSVG, mountGlyph };
}

const { renderStaticSVG, mountGlyph } = createRenderer(BUILT_IN_VARIANTS);
export { renderStaticSVG, mountGlyph };

// ---------------------------------------------------------------- runtime

let engine = null;

function getEngine() {
  if (engine) return engine;
  const reduced = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const instances = [];
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const inst = instances.find((x) => x.svg === e.target);
          if (inst) inst.visible = e.isIntersecting;
        });
      })
    : null;
  if (typeof document !== 'undefined' && !document.getElementById('prismicon-style')) {
    const style = document.createElement('style');
    style.id = 'prismicon-style';
    style.textContent = '@keyframes prismicon-sfade{from{opacity:0}}' +
      '@keyframes prismicon-pulse{0%,100%{opacity:1}50%{opacity:0.35}}' +
      '@keyframes prismicon-ripple-out{from{r:14px;opacity:0.85}to{r:46px;opacity:0}}' +
      '@keyframes prismicon-ripple-in{from{r:46px;opacity:0.85}to{r:14px;opacity:0}}' +
      '@media (prefers-reduced-motion:reduce){.prismicon svg *{animation:none!important}}';
    document.head.appendChild(style);
  }
  let running = false, lastT = 0;
  function loop(now) {
    if (!instances.length) { running = false; return; }
    requestAnimationFrame(loop);
    if (now - lastT < 33) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    const tSec = now / 1000;
    lastT = now;
    for (let i = 0; i < instances.length; i++) step(instances[i], dt, tSec);
  }
  function ensureRunning() {
    if (!running && !reduced && instances.length) {
      running = true; lastT = 0;
      requestAnimationFrame(loop);
    }
  }
  function step(inst, dt, tSec) {
    if (!inst.visible) return;
    const { variant, p, geo } = inst;
    let dirty = false;
    const effects = { dark: inst.dark, sleeping: false, dx: 0, lighten: 0, flash: null };
    if (inst.state === 'sending' || inst.state === 'receiving') {
      inst.transientT += dt;
    }
    const ctx = { params: p, state: inst.state, dt, t: tSec, transientT: inst.transientT, rest: inst.rest };
    const nextPose = variant.animate(inst.pose, ctx);
    if (nextPose !== inst.pose) {
      inst.pose = nextPose;
      dirty = true;
    }
    if (inst.state === 'settling' && nextPose === inst.rest) {
      inst.state = 'idle';
    }
    if ((inst.state === 'sending' || inst.state === 'receiving') && inst.transientT > 0.4) {
      inst.state = 'settling';
    }
    if (inst.flash != null) {
      inst.flashT += dt;
      const t = inst.flashT;
      if (t < 1.4) {
        const s = t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 3);
        effects.flash = { hue: inst.flash, strength: 0.75 * s };
        if (inst.lightenFlash) effects.lighten = 26 * s;
        if (inst.shake) effects.dx = Math.sin(t * 36) * 3.2 * Math.exp(-t * 6);
        dirty = true;
      } else {
        inst.flash = null;
        inst.lightenFlash = false;
        dirty = true;
      }
    }
    effects.sleeping = inst.state === 'sleeping';
    if (dirty) {
      inst.g.innerHTML = variant.paint(p, geo, inst.pose, effects);
      if (effects.sleeping) inst.g.setAttribute('opacity', '0.7');
      else inst.g.removeAttribute('opacity');
    }
  }
  engine = { reduced, instances, io, ensureRunning };
  return engine;
}

function autoDark() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}
