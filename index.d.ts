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
}

declare module 'prismicon/react' {
  import type { CSSProperties, ReactElement } from 'react';
  import type { BuiltInVariantId, GlyphKind, GlyphState } from 'prismicon';

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
  export default Prismicon;
}
