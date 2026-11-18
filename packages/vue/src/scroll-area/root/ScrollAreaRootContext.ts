import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import * as ScrollAreaRootDataAttributes from './ScrollAreaRootDataAttributes';
import type { Orientation } from '../../internals/types';
import type {
  Coords,
  HiddenState,
  OverflowEdges,
  ScrollAreaRootState,
  Size,
} from './ScrollAreaRoot.vue';

export interface ScrollAreaRootContext {
  cornerSize: Readonly<Ref<Size>>;
  setCornerSize(size: Size): void;
  thumbSize: Readonly<Ref<Size>>;
  setThumbSize(size: Size): void;
  hasMeasuredScrollbar: Readonly<Ref<boolean>>;
  setHasMeasuredScrollbar(hasMeasured: boolean): void;
  touchModality: Readonly<Ref<boolean>>;
  hovering: Readonly<Ref<boolean>>;
  setHovering(hovering: boolean): void;
  scrollingX: Readonly<Ref<boolean>>;
  scrollingY: Readonly<Ref<boolean>>;
  // Each part writes its element. The type is `HTMLElement`, because the `as` prop can give
  // another tag.
  viewportElement: ShallowRef<HTMLElement | null>;
  scrollbarYElement: ShallowRef<HTMLElement | null>;
  thumbYElement: ShallowRef<HTMLElement | null>;
  scrollbarXElement: ShallowRef<HTMLElement | null>;
  thumbXElement: ShallowRef<HTMLElement | null>;
  cornerElement: ShallowRef<HTMLElement | null>;
  handlePointerDown(event: PointerEvent, orientation: Orientation, trackPosition?: number): void;
  handlePointerMove(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
  handleScroll(scrollPosition: Coords): void;
  press: Readonly<ShallowRef<{ viewport: HTMLElement } | null>>;
  rootId: ComputedRef<string>;
  hiddenState: Readonly<Ref<HiddenState>>;
  setHiddenState(hiddenState: HiddenState): void;
  overflowEdges: Readonly<Ref<OverflowEdges>>;
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
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
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

export type ScrollAreaScrollbarContext = ComputedRef<'horizontal' | 'vertical'>;

export const ScrollAreaScrollbarContext: InjectionKey<ScrollAreaScrollbarContext> = Symbol();

export function useScrollAreaScrollbarContext(): ScrollAreaScrollbarContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ScrollAreaScrollbarContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <ScrollArea.Thumb> must be inside <ScrollArea.Scrollbar>. Without a scrollbar the thumb has no orientation. Put <ScrollArea.Thumb> inside <ScrollArea.Scrollbar>.',
    );
  }

  return context;
}

export interface ScrollAreaViewportContext {
  computeThumbPosition: () => void;
}

export const ScrollAreaViewportContext: InjectionKey<ScrollAreaViewportContext> = Symbol();

export function useScrollAreaViewportContext(): ScrollAreaViewportContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(ScrollAreaViewportContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: <ScrollArea.Content> must be inside <ScrollArea.Viewport>. Without a viewport the content cannot start a measurement. Put <ScrollArea.Content> inside <ScrollArea.Viewport>.',
    );
  }

  return context;
}
