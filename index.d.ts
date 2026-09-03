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

  export interface GlyphOptions {
    size?: number;
    kind?: GlyphKind;
    state?: GlyphState;
    dark?: boolean;
  }

  export interface GlyphHandle {
    readonly params: GlyphParams;
    readonly state: GlyphState;
    setState(state: GlyphState): void;
    destroy(): void;
  }

  export function normalizeSeed(seed: string): string;
  export function deriveV1(seed: string): GlyphParams;
  export function describeParams(params: GlyphParams): string;
  export function renderStaticSVG(seed: string, opts?: GlyphOptions): string;
  export function mountGlyph(el: HTMLElement, seed: string, opts?: GlyphOptions): GlyphHandle;
}

declare module 'prismicon/react' {
  import type { CSSProperties, ReactElement } from 'react';
  import type { GlyphKind, GlyphState } from 'prismicon';

  export interface PrismiconProps {
    seed: string;
    size?: number;
    kind?: GlyphKind;
    state?: GlyphState;
    dark?: boolean;
    className?: string;
    style?: CSSProperties;
    title?: string;
  }

  export function Prismicon(props: PrismiconProps): ReactElement;
  export default Prismicon;
}
