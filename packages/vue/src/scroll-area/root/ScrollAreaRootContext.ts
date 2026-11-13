import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue';
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
  handlePointerDown(event: PointerEvent): void;
  handlePointerMove(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
  handleScroll(scrollPosition: Coords): void;
  disableViewportSnap(): void;
  reapplyViewportSnapNone(): void;
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
