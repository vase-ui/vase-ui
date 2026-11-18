import { inject } from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter, Ref } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import * as ScrollAreaRootDataAttributes from './ScrollAreaRootDataAttributes';
import type { Orientation } from '../../internals/types';
import type { Coords, OverflowEdges, ScrollAreaRootState, Size } from './ScrollAreaRoot.vue';

export type ScrollAreaElement =
  | 'viewportElement'
  | 'cornerElement'
  | 'scrollbarXElement'
  | 'scrollbarYElement'
  | 'thumbXElement'
  | 'thumbYElement';

export interface ScrollAreaRootContext extends Record<
  ScrollAreaElement,
  Readonly<Ref<HTMLElement | null>>
> {
  cornerSize: Readonly<Size>;
  setCornerSize(size: Size): void;
  thumbSize: Readonly<Size>;
  setThumbSize(size: Size): void;
  hasMeasuredScrollbar: Readonly<Ref<boolean>>;
  markMeasured(): void;
  touchModality: Readonly<Ref<boolean>>;
  hovering: Readonly<Ref<boolean>>;
  markHovered(): void;
  scrollingX: Readonly<Ref<boolean>>;
  scrollingY: Readonly<Ref<boolean>>;
  /** Call in the part’s setup so its scope owns the registration. */
  registerElement(
    name: MaybeRefOrGetter<ScrollAreaElement>,
    element: MaybeRefOrGetter<HTMLElement | null>,
  ): void;
  handlePointerDown(event: PointerEvent, orientation: Orientation, trackPosition?: number): void;
  handlePointerMove(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
  handleScroll(scrollPosition: Coords): void;
  press: Readonly<Ref<{ viewport: HTMLElement } | null>>;
  rootId: ComputedRef<string>;
  setHiddenAxes(x: boolean, y: boolean): void;
  setOverflowEdges(overflowEdges: OverflowEdges): void;
  viewportState: ComputedRef<ScrollAreaRootState>;
  overflowEdgeThreshold: ComputedRef<{
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  }>;
}

export const ScrollAreaRootContext: InjectionKey<ScrollAreaRootContext> = Symbol();

export function useScrollAreaRootContext(): ScrollAreaRootContext {
  const context = inject(ScrollAreaRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Scroll Area must be inside <ScrollArea.Root>. Without a root the part has no scroll state to read. Put the part inside <ScrollArea.Root>.',
    );
  }

  return context;
}

export const SCROLL_TIMEOUT = 500;
export const MIN_THUMB_SIZE = 16;

const attr = (name: string) => (value: boolean) => (value ? { [name]: '' } : null);

export const scrollAreaStateAttributesMapping: StateAttributesMapping<ScrollAreaRootState> = {
  hasOverflowX: attr(ScrollAreaRootDataAttributes.hasOverflowX),
  hasOverflowY: attr(ScrollAreaRootDataAttributes.hasOverflowY),
  overflowXStart: attr(ScrollAreaRootDataAttributes.overflowXStart),
  overflowXEnd: attr(ScrollAreaRootDataAttributes.overflowXEnd),
  overflowYStart: attr(ScrollAreaRootDataAttributes.overflowYStart),
  overflowYEnd: attr(ScrollAreaRootDataAttributes.overflowYEnd),
  cornerHidden: () => null,
};

export type ScrollAreaScrollbarContext = ComputedRef<Orientation>;

export const ScrollAreaScrollbarContext: InjectionKey<ScrollAreaScrollbarContext> = Symbol();

export function useScrollAreaScrollbarContext(): ScrollAreaScrollbarContext {
  const context = inject(ScrollAreaScrollbarContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <ScrollArea.Thumb> must be inside <ScrollArea.Scrollbar>. Without a scrollbar the thumb has no orientation. Put <ScrollArea.Thumb> inside <ScrollArea.Scrollbar>.',
    );
  }

  return context;
}

export type ScrollAreaViewportContext = () => void;

export const ScrollAreaViewportContext: InjectionKey<ScrollAreaViewportContext> = Symbol();

export function useScrollAreaViewportContext(): ScrollAreaViewportContext {
  const context = inject(ScrollAreaViewportContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <ScrollArea.Content> must be inside <ScrollArea.Viewport>. Without a viewport the content cannot start a measurement. Put <ScrollArea.Content> inside <ScrollArea.Viewport>.',
    );
  }

  return context;
}
