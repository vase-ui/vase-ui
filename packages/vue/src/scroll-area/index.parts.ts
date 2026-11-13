import ScrollAreaRoot from './root/ScrollAreaRoot.vue';
import type { ScrollAreaRootProps, ScrollAreaRootState } from './root/ScrollAreaRoot.vue';
import ScrollAreaViewport from './viewport/ScrollAreaViewport.vue';
import type {
  ScrollAreaViewportProps,
  ScrollAreaViewportState,
} from './viewport/ScrollAreaViewport.vue';
import ScrollAreaScrollbar from './scrollbar/ScrollAreaScrollbar.vue';
import type {
  ScrollAreaScrollbarProps,
  ScrollAreaScrollbarState,
} from './scrollbar/ScrollAreaScrollbar.vue';
import ScrollAreaContent from './content/ScrollAreaContent.vue';
import type {
  ScrollAreaContentProps,
  ScrollAreaContentState,
} from './content/ScrollAreaContent.vue';
import ScrollAreaThumb from './thumb/ScrollAreaThumb.vue';
import type { ScrollAreaThumbProps, ScrollAreaThumbState } from './thumb/ScrollAreaThumb.vue';
import ScrollAreaCorner from './corner/ScrollAreaCorner.vue';
import type { ScrollAreaCornerProps, ScrollAreaCornerState } from './corner/ScrollAreaCorner.vue';

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
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 */
export const Scrollbar: typeof ScrollAreaScrollbar = ScrollAreaScrollbar;
export namespace Scrollbar {
  export type Props = ScrollAreaScrollbarProps;
  export type State = ScrollAreaScrollbarState;
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
  export type State = ScrollAreaCornerState;
}
