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
