import ToastAction from './action/ToastAction.vue';
import type { ToastActionProps, ToastActionState } from './action/ToastAction.vue';
import ToastArrow from './arrow/ToastArrow.vue';
import type { ToastArrowProps, ToastArrowState } from './arrow/ToastArrow.vue';
import ToastClose from './close/ToastClose.vue';
import type { ToastCloseProps, ToastCloseState } from './close/ToastClose.vue';
import ToastContent from './content/ToastContent.vue';
import type { ToastContentProps, ToastContentState } from './content/ToastContent.vue';
import ToastDescription from './description/ToastDescription.vue';
import type {
  ToastDescriptionProps,
  ToastDescriptionState,
} from './description/ToastDescription.vue';
import ToastPortal from './portal/ToastPortal.vue';
import type { ToastPortalProps, ToastPortalState } from './portal/ToastPortal.vue';
import ToastPositioner from './positioner/ToastPositioner.vue';
import type { ToastPositionerProps, ToastPositionerState } from './positioner/ToastPositioner.vue';
import ToastProvider from './provider/ToastProvider.vue';
import type { ToastProviderProps, ToastProviderState } from './provider/ToastProvider.vue';
import ToastRoot from './root/ToastRoot.vue';
import type { ToastRootProps, ToastRootState, ToastRootToastObject } from './root/ToastRoot.vue';
import ToastTitle from './title/ToastTitle.vue';
import type { ToastTitleProps, ToastTitleState } from './title/ToastTitle.vue';
import ToastViewport from './viewport/ToastViewport.vue';
import type { ToastViewportProps, ToastViewportState } from './viewport/ToastViewport.vue';

/**
 * Provides a context for creating and managing toasts.
 * Doesn't render its own HTML element.
 */
export const Provider: typeof ToastProvider = ToastProvider;
export namespace Provider {
  export type State = ToastProviderState;
  export type Props = ToastProviderProps;
}

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * The part has more than one root node. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Viewport: typeof ToastViewport = ToastViewport;
export namespace Viewport {
  export type State = ToastViewportState;
  export type Props = ToastViewportProps;
}

/**
 * Groups all parts of an individual toast.
 * Renders a `<div>` element.
 */
export const Root: typeof ToastRoot = ToastRoot;
export namespace Root {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props = ToastRootProps;
}

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 */
export const Content: typeof ToastContent = ToastContent;
export namespace Content {
  export type State = ToastContentState;
  export type Props = ToastContentProps;
}

/**
 * A description that describes the toast.
 * Can be used as the default message for the toast when no title is provided.
 * Renders a `<p>` element.
 */
export const Description: typeof ToastDescription = ToastDescription;
export namespace Description {
  export type State = ToastDescriptionState;
  export type Props = ToastDescriptionProps;
}

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 */
export const Title: typeof ToastTitle = ToastTitle;
export namespace Title {
  export type State = ToastTitleState;
  export type Props = ToastTitleProps;
}

/**
 * Closes the toast when clicked.
 * Renders a `<button>` element.
 */
export const Close: typeof ToastClose = ToastClose;
export namespace Close {
  export type State = ToastCloseState;
  export type Props = ToastCloseProps;
}

/**
 * Performs an action when clicked.
 * Renders a `<button>` element.
 */
export const Action: typeof ToastAction = ToastAction;
export namespace Action {
  export type State = ToastActionState;
  export type Props = ToastActionProps;
}

/**
 * A portal element that moves the viewport to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof ToastPortal = ToastPortal;
export namespace Portal {
  export type State = ToastPortalState;
  export type Props = ToastPortalProps;
}

/**
 * Positions the toast against the anchor.
 * Renders a `<div>` element.
 */
export const Positioner: typeof ToastPositioner = ToastPositioner;
export namespace Positioner {
  export type State = ToastPositionerState;
  export type Props = ToastPositionerProps;
}

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof ToastArrow = ToastArrow;
export namespace Arrow {
  export type State = ToastArrowState;
  export type Props = ToastArrowProps;
}

export { useToastManager } from './useToastManager';
export { createToastManager } from './createToastManager';
