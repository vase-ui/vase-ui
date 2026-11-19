import type { HTMLAttributes } from 'vue';

export interface ScrollAreaRootProps extends /* @vue-ignore */ HTMLAttributes {
  /**
   * The distance in pixels from an edge within which the edge has no overflow state. A number is for
   * each edge. A missing or negative number is `0`.
   * @default 0
   */
  overflowEdgeThreshold?:
    number | { xStart?: number; xEnd?: number; yStart?: number; yEnd?: number };
}

export interface ScrollAreaRootState {
  /** The user scrolls one axis or the two axes. A scroll of a script does not count. */
  scrolling: boolean;
  hasOverflowX: boolean;
  hasOverflowY: boolean;
  /** The content overflows the inline start edge. */
  overflowXStart: boolean;
  /** The content overflows the inline end edge. */
  overflowXEnd: boolean;
  /** The content overflows the top edge. */
  overflowYStart: boolean;
  /** The content overflows the bottom edge. */
  overflowYEnd: boolean;
  /** One axis or no axis has overflow, so `ScrollArea.Corner` renders nothing. */
  cornerHidden: boolean;
}

export type ScrollAreaViewportState = ScrollAreaRootState;
export type ScrollAreaContentState = ScrollAreaRootState;

export interface ScrollAreaScrollbarProps extends /* @vue-ignore */ HTMLAttributes {
  /**
   * The axis that the scrollbar scrolls.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * The scrollbar renders also while its axis has no overflow.
   * @default false
   */
  keepMounted?: boolean;
}

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /** The user scrolls the axis of this scrollbar. */
  scrolling: boolean;
  orientation: 'vertical' | 'horizontal';
}

export interface ScrollAreaThumbState {
  /** The user scrolls the axis of this thumb. */
  scrolling: boolean;
  orientation: 'vertical' | 'horizontal';
}
