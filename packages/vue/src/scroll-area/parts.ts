import ScrollAreaContent from './ScrollAreaContent.vue';
import ScrollAreaCorner from './ScrollAreaCorner.vue';
import ScrollAreaRoot from './ScrollAreaRoot.vue';
import ScrollAreaScrollbar from './ScrollAreaScrollbar.vue';
import ScrollAreaThumb from './ScrollAreaThumb.vue';
import ScrollAreaViewport from './ScrollAreaViewport.vue';
import type {
  ScrollAreaContentProps,
  ScrollAreaContentState,
  ScrollAreaCornerProps,
  ScrollAreaRootProps,
  ScrollAreaRootState,
  ScrollAreaScrollbarProps,
  ScrollAreaScrollbarState,
  ScrollAreaThumbProps,
  ScrollAreaThumbState,
  ScrollAreaViewportProps,
  ScrollAreaViewportState,
} from './types';

/**
 * Groups all parts of the scroll area.
 * Renders a `<div>` element.
 */
export const Root: typeof ScrollAreaRoot = ScrollAreaRoot;
export namespace Root {
  export type Props = ScrollAreaRootProps;
  export type State = ScrollAreaRootState;
}

/**
 * The actual scrollable container of the scroll area.
 * Renders a `<div>` element.
 */
export const Viewport: typeof ScrollAreaViewport = ScrollAreaViewport;
export namespace Viewport {
  export type Props = ScrollAreaViewportProps;
  export type State = ScrollAreaViewportState;
}

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 */
export const Content: typeof ScrollAreaContent = ScrollAreaContent;
export namespace Content {
  export type Props = ScrollAreaContentProps;
  export type State = ScrollAreaContentState;
}

/**
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 */
export const Scrollbar: typeof ScrollAreaScrollbar = ScrollAreaScrollbar;
export namespace Scrollbar {
  export type Props = ScrollAreaScrollbarProps;
  export type State = ScrollAreaScrollbarState;
}

/**
 * The draggable part of the scrollbar that indicates the current scroll position.
 * Renders a `<div>` element.
 */
export const Thumb: typeof ScrollAreaThumb = ScrollAreaThumb;
export namespace Thumb {
  export type Props = ScrollAreaThumbProps;
  export type State = ScrollAreaThumbState;
}

/**
 * A small rectangular area that appears at the intersection of horizontal and vertical scrollbars.
 * Renders a `<div>` element.
 */
export const Corner: typeof ScrollAreaCorner = ScrollAreaCorner;
export namespace Corner {
  export type Props = ScrollAreaCornerProps;
}
