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
 * Groups all parts of the scroll area. It hides the native scrollbars of the viewport. With the
 * `element` slot, the server HTML has no style element, so the native scrollbars show until the
 * mount.
 * Renders a `<div>` element.
 * @selector `[data-scrolling]` The user scrolls, with a wheel, a touch, the keyboard or a drag. It ends 500 ms after the last scroll. A scroll of a script does not count.
 * @selector `[data-has-overflow-x]` The content overflows the viewport on the horizontal axis.
 * @selector `[data-has-overflow-y]` The content overflows the viewport on the vertical axis.
 * @selector `[data-overflow-x-start]` The content overflows the inline start edge.
 * @selector `[data-overflow-x-end]` The content overflows the inline end edge.
 * @selector `[data-overflow-y-start]` The content overflows the top edge.
 * @selector `[data-overflow-y-end]` The content overflows the bottom edge.
 * @cssVariable `--scroll-area-corner-width` The width of the corner, in pixels. It is `0px` with no corner.
 * @cssVariable `--scroll-area-corner-height` The height of the corner, in pixels. It is `0px` with no corner.
 */
export const Root: typeof ScrollAreaRoot = ScrollAreaRoot;
export namespace Root {
  export type Props = ScrollAreaRootProps;
  export type State = ScrollAreaRootState;
}

/**
 * The actual scrollable container of the scroll area. It is a native scroll container on the two
 * axes, so the wheel, a touch, the keyboard and scroll snap work as in each browser. It is a tab
 * stop while it can scroll and its content holds no tab stop. A control in the content scrolls it
 * with the keyboard, so Tab goes to that control. Firefox scrolls with no key from a text field:
 * for content with only text fields, give the viewport `tabindex="0"`. When it is a landmark of the
 * page, give it `role="region"` and a name, such as `aria-label`.
 * Renders a `<div>` element.
 * @selector `[data-scrolling]` The user scrolls, with a wheel, a touch, the keyboard or a drag. It ends 500 ms after the last scroll. A scroll of a script does not count.
 * @selector `[data-has-overflow-x]` The content overflows the viewport on the horizontal axis.
 * @selector `[data-has-overflow-y]` The content overflows the viewport on the vertical axis.
 * @selector `[data-overflow-x-start]` The content overflows the inline start edge.
 * @selector `[data-overflow-x-end]` The content overflows the inline end edge.
 * @selector `[data-overflow-y-start]` The content overflows the top edge.
 * @selector `[data-overflow-y-end]` The content overflows the bottom edge.
 * @cssVariable `--scroll-area-overflow-x-start` The distance to the inline start edge of the content, in pixels.
 * @cssVariable `--scroll-area-overflow-x-end` The distance to the inline end edge of the content, in pixels.
 * @cssVariable `--scroll-area-overflow-y-start` The distance to the top edge of the content, in pixels.
 * @cssVariable `--scroll-area-overflow-y-end` The distance to the bottom edge of the content, in pixels.
 */
export const Viewport: typeof ScrollAreaViewport = ScrollAreaViewport;
export namespace Viewport {
  export type Props = ScrollAreaViewportProps;
  export type State = ScrollAreaViewportState;
}

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 * @selector `[data-scrolling]` The user scrolls, with a wheel, a touch, the keyboard or a drag. It ends 500 ms after the last scroll. A scroll of a script does not count.
 * @selector `[data-has-overflow-x]` The content overflows the viewport on the horizontal axis.
 * @selector `[data-has-overflow-y]` The content overflows the viewport on the vertical axis.
 * @selector `[data-overflow-x-start]` The content overflows the inline start edge.
 * @selector `[data-overflow-x-end]` The content overflows the inline end edge.
 * @selector `[data-overflow-y-start]` The content overflows the top edge.
 * @selector `[data-overflow-y-end]` The content overflows the bottom edge.
 */
export const Content: typeof ScrollAreaContent = ScrollAreaContent;
export namespace Content {
  export type Props = ScrollAreaContentProps;
  export type State = ScrollAreaContentState;
}

/**
 * A vertical or horizontal scrollbar for the scroll area. It lies over the viewport and takes no
 * space. Assistive technology does not read it. It renders while its axis has overflow. To show it
 * at a hover, select `:hover` of the root.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The axis of the scrollbar: `vertical` or `horizontal`.
 * @selector `[data-scrolling]` The user scrolls the axis of the scrollbar.
 * @selector `[data-has-overflow-x]` The content overflows the viewport on the horizontal axis.
 * @selector `[data-has-overflow-y]` The content overflows the viewport on the vertical axis.
 * @selector `[data-overflow-x-start]` The content overflows the inline start edge.
 * @selector `[data-overflow-x-end]` The content overflows the inline end edge.
 * @selector `[data-overflow-y-start]` The content overflows the top edge.
 * @selector `[data-overflow-y-end]` The content overflows the bottom edge.
 * @cssVariable `--scroll-area-thumb-height` The length of the thumb of a vertical scrollbar, in pixels. It counts the padding of the scrollbar and the margins of the thumb.
 * @cssVariable `--scroll-area-thumb-width` The length of the thumb of a horizontal scrollbar, in pixels. It counts the padding of the scrollbar and the margins of the thumb.
 */
export const Scrollbar: typeof ScrollAreaScrollbar = ScrollAreaScrollbar;
export namespace Scrollbar {
  export type Props = ScrollAreaScrollbarProps;
  export type State = ScrollAreaScrollbarState;
}

/**
 * The draggable part of the scrollbar that indicates the current scroll position. It moves with
 * the CSS property `translate`, so `transform` stays free for your styles. Give a horizontal thumb
 * equal inline margins: in right-to-left text, the part counts the start margin two times in WebKit.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The axis of the scrollbar: `vertical` or `horizontal`.
 * @selector `[data-scrolling]` The user scrolls the axis of the thumb.
 */
export const Thumb: typeof ScrollAreaThumb = ScrollAreaThumb;
export namespace Thumb {
  export type Props = ScrollAreaThumbProps;
  export type State = ScrollAreaThumbState;
}

/**
 * A small rectangular area that appears at the intersection of horizontal and vertical scrollbars.
 * It renders while the two axes have overflow. Assistive technology does not read it.
 * Renders a `<div>` element.
 */
export const Corner: typeof ScrollAreaCorner = ScrollAreaCorner;
export namespace Corner {
  export type Props = ScrollAreaCornerProps;
}
