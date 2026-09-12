declare module 'prismicon' {
  export const SPEC_VERSION: string;
  export const STATES: GlyphState[];
  export const PALETTE: number[];
  export const SIDE_NAMES: Record<number, string>;
  export const SOLID_NAMES: string[];
  export const FINISH_NAMES: string[];

  export type GlyphState = 'idle' | 'working' | 'waiting' | 'done' | 'error' | 'thinking' | 'sending' | 'receiving' | 'sleeping';
  export type GlyphKind = 'agent' | 'user';

  export interface GlyphParams {
    spec: string;
    seed: string;
    hash: number;
    n: 3 | 4 | 5 | 6;
    solidType: 0 | 1 | 2 | 3;
    finish: 0 | 1 | 2;
    prop: number;
    axisMode: 0 | 1 | 2;
    speed: number;
    phase: number;
    precess: boolean;
    zSpeed: number;
    phase2: number;
    hue: number;
    hue2: number;
  }

  /**
   * Built-in variant ids: `polyhedron` (default), `ncube` (dimension derived from
   * the seed) and `ncube-<d>` for each supported dimension, 3 up to the frozen
   * NCUBE_MAX_DIMENSION. Custom ids remain accepted as plain strings.
   */
  export type BuiltInVariantId = 'polyhedron' | 'ncube' | `ncube-${number}`;

  /** Params produced by the n-cube family (spec `ncube-v1`). */
  export interface NcubeParams {
    spec: string;
    seed: string;
    hash: number;
    /** Cube dimension in [3, NCUBE_MAX_DIMENSION]. */
    dimension: number;
    finish: 0 | 1 | 2;
    /** Plane angles for axes 3.., always NCUBE_MAX_DIMENSION - 3 entries. */
    theta: readonly number[];
    ax: number;
    ay: number;
    az: number;
    hue: number;
    hue2: number;
    /**
     * Prepared, non-identity fields below are present on `GlyphHandle.params`
     * (output of `prepare`), not in `deriveNcube` output.
     */
    /** Edge stroke width in viewBox units, chosen per dimension. */
    readonly strokeWidth?: number;
    /** Sense of the hyper-rotation and send/receive burst. */
    readonly dir?: 1 | -1;
    /** rad/s of the highest plane `theta[dimension - 4]` while working; 0 for a 3-cube. */
    readonly hyperSpeed?: number;
    /** The 3D angle that drifts while working. */
    readonly spinAxis?: 'ax' | 'ay' | 'az';
    /** rad/s of the slow 3D spin on `spinAxis` while working. */
    readonly spin3?: number;
    /** Sway/wobble phase offsets (reuse `ax` / `ay`). */
    readonly phase?: number;
    readonly phase2?: number;
  }

  export interface GlyphOptions {
    size?: number;
    kind?: GlyphKind;
    state?: GlyphState;
    dark?: boolean;
    /**
     * Variant id. Omit to use the default variant. Unknown ids throw RangeError.
     */
    variant?: BuiltInVariantId | (string & {});
  }

  export interface GlyphHandle {
    /**
     * Derived params of the mounted variant. Narrow on `variant` (or on
     * `'dimension' in params`) before reading variant-specific fields:
     * `polyhedron` yields GlyphParams, the n-cube family yields NcubeParams.
     */
    readonly params: GlyphParams | NcubeParams;
    readonly variant: string;
    readonly state: GlyphState;
    setState(state: GlyphState): void;
    destroy(): void;
  }

  export interface VariantInfo {
    id: string;
    label: string;
    spec: string;
  }

  export const DEFAULT_VARIANT_ID: string;
  export function listVariants(): ReadonlyArray<VariantInfo>;

  export function normalizeSeed(seed: string): string;
  export function deriveV1(seed: string): GlyphParams;
  export function describeParams(params: GlyphParams): string;
  export function renderStaticSVG(seed: string, opts?: GlyphOptions): string;
  export function mountGlyph(el: HTMLElement, seed: string, opts?: GlyphOptions): GlyphHandle;

  // ---------------------------------------------------------------------------
  // Custom variant authoring
  // ---------------------------------------------------------------------------

  /** Ids are stable, URL- and prop-safe tokens: `/^[a-z][a-z0-9-]*$/`. */
  export const VARIANT_ID_PATTERN: RegExp;

  /**
   * Transient emphasis returned by `flash` on a state transition. `lighten` is the peak
   * lightness boost in percentage points; the engine scales it by the flash envelope.
   */
  export interface VariantFlash {
    hue?: number;
    lighten?: number;
    shake?: boolean;
  }

  /** Effects the engine passes to `paint`; under reduced motion these are the idle values. */
  export interface VariantPaintEffects {
    /** `undefined` when a static-render caller omits `dark`; mounted glyphs always pass a boolean. */
    dark?: boolean;
    sleeping: boolean;
    dx: number;
    lighten: number;
    flash: { hue?: number; strength: number } | null;
  }

  /** Per-frame context passed to `animate`; `dt` and `t` are seconds. */
  export interface VariantAnimateContext<P = object, Pose = object> {
    params: P;
    state: GlyphState | 'settling';
    dt: number;
    t: number;
    transientT: number;
    /** Rest pose for the current state; return it from `animate` while `settling` to finish. */
    rest: Pose;
  }

  /**
   * One complete visual style. Every hook must be a pure function of its arguments:
   * `validateVariant` runs the pipeline twice and rejects any difference, and runs the
   * static path with browser globals blocked. Under reduced motion `animate` is never
   * called and `pose(params, state)` is painted as-is, so the idle `paint` output is the
   * variant's reduced-motion appearance.
   */
  export interface VariantDescriptor<P = object, G = object, Pose = object> {
    /** Matches VARIANT_ID_PATTERN; unique within a registry. */
    id: string;
    /** Human-readable name shown by `listVariants()`. */
    label: string;
    /** Derivation spec the seed-derived identities are frozen under; bump it when they change. */
    spec: string;
    /** Called once per render/mount with the raw seed; must be deterministic and SSR-safe. */
    derive(seed: string): P;
    /** Called for the accessible `<title>`/`aria-label`; must return a non-empty string. */
    describe(params: P): string;
    /** Called once per render/mount after `derive`, with the requested pixel size. */
    prepare(params: P, ctx: { size: number }): P;
    /** Called once per render/mount after `prepare`; the result is reused for every frame. */
    geometry(params: P): G;
    /** Called for the rest pose of a state (`idle` for static renders, on every state change). */
    pose(params: P, state: GlyphState | 'settling'): Pose;
    /** Called once per animation frame while motion is enabled; must return a new pose object. */
    animate(pose: Pose, ctx: VariantAnimateContext<P, Pose>): Pose;
    /** Called for every static render and every frame; returns the inner SVG markup string. */
    paint(params: P, geometry: G, pose: Pose, effects: VariantPaintEffects): string;
    /** Called on each state transition; return `null` for no emphasis. `validateVariant` also probes it with `'settling'`. */
    flash(params: P, state: GlyphState | 'settling'): VariantFlash | null;
  }

  /** Immutable registry: adding a variant means building a new registry from a longer list. */
  export interface VariantRegistry {
    readonly ids: ReadonlyArray<string>;
    readonly defaultId: string;
    has(id: string): boolean;
    /** Unknown id throws RangeError. */
    get(id: string): Readonly<VariantDescriptor>;
    /** `undefined`/`null` resolves to the default; unknown id throws RangeError; non-string throws TypeError. */
    resolve(key?: string | null): Readonly<VariantDescriptor>;
  }

  export interface ValidateVariantOptions {
    /** Seeds the probes run over; defaults to the five golden seeds. */
    seeds?: ReadonlyArray<string>;
    /** Pixel size passed to `prepare`; defaults to 64. */
    size?: number;
    /** States probed for `pose`/`paint`/`flash`/`animate`; defaults to every state plus `settling`. */
    states?: ReadonlyArray<GlyphState | 'settling' | (string & {})>;
  }

  export interface CreatePrismiconOptions {
    /** Custom descriptors; ids must not duplicate each other or a built-in. */
    variants?: ReadonlyArray<VariantDescriptor<any, any, any>>;
    /** Id resolved when `variant` is omitted; defaults to DEFAULT_VARIANT_ID. Must be registered. */
    defaultId?: string;
    /** Include the built-in variants; defaults to `true`. With `false`, `defaultId` must name a custom variant. */
    builtIns?: boolean;
    /** Run `validateVariant` on each custom descriptor; defaults to `true`. */
    validate?: boolean;
  }

  /** Frozen renderer bound to one registry; hoist to module scope so the registry identity is stable. */
  export interface PrismiconInstance {
    readonly registry: VariantRegistry;
    renderStaticSVG(seed: string, opts?: GlyphOptions): string;
    mountGlyph(el: HTMLElement, seed: string, opts?: GlyphOptions): GlyphHandle;
    listVariants(): ReadonlyArray<VariantInfo>;
  }

  /** Shape check only: returns a frozen copy or throws TypeError naming the offending field. */
  export function defineVariant<P = object, G = object, Pose = object>(
    descriptor: VariantDescriptor<P, G, Pose>
  ): Readonly<VariantDescriptor<P, G, Pose>>;

  /**
   * Shape check plus determinism and SSR-safety probes. Throws TypeError whose message
   * starts with `Variant "<id>"` and names the failing probe and hook. Returns the frozen descriptor.
   */
  export function validateVariant<P = object, G = object, Pose = object>(
    descriptor: VariantDescriptor<P, G, Pose>,
    options?: ValidateVariantOptions
  ): Readonly<VariantDescriptor<P, G, Pose>>;

  /** Throws TypeError on a non-array, a duplicate id, or an unregistered `defaultId`. */
  export function createVariantRegistry(
    descriptors: ReadonlyArray<VariantDescriptor<any, any, any>>,
    options: { defaultId: string }
  ): Readonly<VariantRegistry>;

  /** Build a renderer for the built-ins plus `variants`; never mutates the module-level registry. */
  export function createPrismicon(options?: CreatePrismiconOptions): Readonly<PrismiconInstance>;
}

declare module 'prismicon/react' {
  import type { CSSProperties, ReactElement, ReactNode } from 'react';
  import type { BuiltInVariantId, GlyphKind, GlyphState, VariantRegistry } from 'prismicon';

  export interface PrismiconProps {
    seed: string;
    size?: number;
    kind?: GlyphKind;
    state?: GlyphState;
    dark?: boolean;
    /** Variant id. Omit to use the default variant. Unknown ids throw RangeError during render. */
    variant?: BuiltInVariantId | (string & {});
    className?: string;
    style?: CSSProperties;
    title?: string;
  }

  export function Prismicon(props: PrismiconProps): ReactElement;

  export interface PrismiconProviderProps {
    /**
     * Registry every `<Prismicon>` below resolves `variant` against, e.g.
     * `createPrismicon({ variants }).registry`. Hoist it to module scope: glyphs
     * remount whenever the registry identity changes. Non-registries throw TypeError.
     */
    registry: VariantRegistry;
    children?: ReactNode;
  }

  export function PrismiconProvider(props: PrismiconProviderProps): ReactElement;

  export default Prismicon;
}
