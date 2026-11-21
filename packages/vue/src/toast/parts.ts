import ToastAction from './ToastAction.vue';
import ToastArrow from './ToastArrow.vue';
import ToastClose from './ToastClose.vue';
import ToastContent from './ToastContent.vue';
import ToastDescription from './ToastDescription.vue';
import ToastPortal from './ToastPortal.vue';
import ToastPositioner from './ToastPositioner.vue';
import ToastProvider from './ToastProvider.vue';
import ToastRoot from './ToastRoot.vue';
import ToastTitle from './ToastTitle.vue';
import ToastViewport from './ToastViewport.vue';
import type {
  ToastActionProps,
  ToastActionState,
  ToastArrowProps,
  ToastArrowState,
  ToastCloseProps,
  ToastCloseState,
  ToastContentProps,
  ToastContentState,
  ToastDescriptionProps,
  ToastDescriptionState,
  ToastPortalProps,
  ToastPortalState,
  ToastPositionerProps,
  ToastPositionerState,
  ToastProviderProps,
  ToastProviderState,
  ToastRootProps,
  ToastRootState,
  ToastTitleProps,
  ToastTitleState,
  ToastViewportProps,
  ToastViewportState,
} from './types';

export { createToastManager } from './manager';
export { useToastManager } from './provider';

/**
 * Holds the toasts and their timers.
 * Renders no element.
 */
export const Provider: typeof ToastProvider = ToastProvider;
export namespace Provider {
  export type Props = ToastProviderProps;
  export type State = ToastProviderState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof ToastPortal = ToastPortal;
export namespace Portal {
  export type Props = ToastPortalProps;
  export type State = ToastPortalState;
}

/**
 * The region that holds the toasts.
 * Renders a `<div>` element.
 * @selector `[data-expanded]` The pointer is on the viewport, or the keyboard focus is in it.
 * @cssVariable `--toast-frontmost-height` The height of the frontmost toast, in pixels.
 */
export const Viewport: typeof ToastViewport = ToastViewport;
export namespace Viewport {
  export type Props = ToastViewportProps;
  export type State = ToastViewportState;
}

/**
 * One toast.
 * Renders a `<div>` element.
 * @selector `[data-expanded]` The viewport is expanded: the pointer is on it, or the keyboard focus is in it.
 * @selector `[data-type]` The `type` of the toast. The toast of a `promise` call has `loading`, `success` or `error`.
 * @selector `[data-swiping]` The user swipes the toast.
 * @selector `[data-swipe-direction]` The direction of the swipe while the user swipes the toast, and of the swipe that closed it: `up`, `down`, `left` or `right`.
 * @selector `[inert]` The toast is over the `limit` of the provider.
 * @cssVariable `--toast-index` The place of the toast in the list. The frontmost toast has 0.
 * @cssVariable `--toast-offset-y` The vertical offset of the toast in the expanded viewport, in pixels.
 * @cssVariable `--toast-height` The natural height of the toast, with `height: auto`, in pixels.
 * @cssVariable `--toast-swipe-movement-x` The horizontal movement of the swipe, in pixels.
 * @cssVariable `--toast-swipe-movement-y` The vertical movement of the swipe, in pixels.
 */
export const Root: typeof ToastRoot = ToastRoot;
export namespace Root {
  export type Props = ToastRootProps;
  export type State = ToastRootState;
}

/**
 * The container of the content of a toast.
 * Renders a `<div>` element.
 * @selector `[data-behind]` The toast is behind the frontmost toast.
 * @selector `[data-expanded]` The viewport is expanded: the pointer is on it, or the keyboard focus is in it.
 */
export const Content: typeof ToastContent = ToastContent;
export namespace Content {
  export type Props = ToastContentProps;
  export type State = ToastContentState;
}

/**
 * A heading that names the toast.
 * Renders an `<h2>` element.
 * @selector `[data-type]` The `type` of the toast.
 */
export const Title: typeof ToastTitle = ToastTitle;
export namespace Title {
  export type Props = ToastTitleProps;
  export type State = ToastTitleState;
}

/**
 * A paragraph that describes the toast.
 * Renders a `<p>` element.
 * @selector `[data-type]` The `type` of the toast.
 */
export const Description: typeof ToastDescription = ToastDescription;
export namespace Description {
  export type Props = ToastDescriptionProps;
  export type State = ToastDescriptionState;
}

/**
 * A button that does the action of the toast.
 * Renders a `<button>` element.
 * @selector `[data-type]` The `type` of the toast.
 * @selector `:disabled` The button is a native button, and it is disabled.
 * @selector `[aria-disabled="true"]` The button is another element, and it is disabled.
 */
export const Action: typeof ToastAction = ToastAction;
export namespace Action {
  export type Props = ToastActionProps;
  export type State = ToastActionState;
}

/**
 * A button that closes the toast.
 * Renders a `<button>` element.
 * @selector `[data-type]` The `type` of the toast.
 * @selector `:disabled` The button is a native button, and it is disabled.
 * @selector `[aria-disabled="true"]` The button is another element, and it is disabled.
 */
export const Close: typeof ToastClose = ToastClose;
export namespace Close {
  export type Props = ToastCloseProps;
  export type State = ToastCloseState;
}

/**
 * Places an anchored toast at its anchor.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the toast is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`. A logical side shows only when the `side` prop or the `side` of `positionerProps` is logical.
 * @selector `[data-align]` The alignment of the toast on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @cssVariable `--anchor-width` The width of the anchor, in pixels.
 * @cssVariable `--anchor-height` The height of the anchor, in pixels.
 * @cssVariable `--available-width` The width from the anchor to the edge of the collision boundary, in pixels.
 * @cssVariable `--available-height` The height from the anchor to the edge of the collision boundary, in pixels.
 * @cssVariable `--transform-origin` The point that the toast grows from.
 * @cssVariable `--toast-index` The place of the toast in the list. The frontmost toast has 0.
 */
export const Positioner: typeof ToastPositioner = ToastPositioner;
export namespace Positioner {
  export type Props = ToastPositionerProps;
  export type State = ToastPositionerState;
}

/**
 * An element that points to the center of the anchor of the toast.
 * Renders a `<div>` element.
 * Its place is in the padding box of its nearest positioned ancestor: the toast when the toast has a `position`, else the positioner.
 * @selector `[data-side]` The side of the anchor that the toast is on, as on the positioner.
 * @selector `[data-align]` The alignment of the toast on its side: `start`, `center` or `end`.
 * @selector `[data-uncentered]` The arrow cannot point to the center of the anchor.
 */
export const Arrow: typeof ToastArrow = ToastArrow;
export namespace Arrow {
  export type Props = ToastArrowProps;
  export type State = ToastArrowState;
}
