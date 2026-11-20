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
 */
export const Viewport: typeof ToastViewport = ToastViewport;
export namespace Viewport {
  export type Props = ToastViewportProps;
  export type State = ToastViewportState;
}

/**
 * One toast.
 * Renders a `<div>` element.
 */
export const Root: typeof ToastRoot = ToastRoot;
export namespace Root {
  export type Props = ToastRootProps;
  export type State = ToastRootState;
}

/**
 * The container of the content of a toast.
 * Renders a `<div>` element.
 */
export const Content: typeof ToastContent = ToastContent;
export namespace Content {
  export type Props = ToastContentProps;
  export type State = ToastContentState;
}

/**
 * A heading that names the toast.
 * Renders an `<h2>` element.
 */
export const Title: typeof ToastTitle = ToastTitle;
export namespace Title {
  export type Props = ToastTitleProps;
  export type State = ToastTitleState;
}

/**
 * A paragraph that describes the toast.
 * Renders a `<p>` element.
 */
export const Description: typeof ToastDescription = ToastDescription;
export namespace Description {
  export type Props = ToastDescriptionProps;
  export type State = ToastDescriptionState;
}

/**
 * A button that does the action of the toast.
 * Renders a `<button>` element.
 */
export const Action: typeof ToastAction = ToastAction;
export namespace Action {
  export type Props = ToastActionProps;
  export type State = ToastActionState;
}

/**
 * A button that closes the toast.
 * Renders a `<button>` element.
 */
export const Close: typeof ToastClose = ToastClose;
export namespace Close {
  export type Props = ToastCloseProps;
  export type State = ToastCloseState;
}

/**
 * Places an anchored toast at its anchor.
 * Renders a `<div>` element.
 */
export const Positioner: typeof ToastPositioner = ToastPositioner;
export namespace Positioner {
  export type Props = ToastPositionerProps;
  export type State = ToastPositionerState;
}

/**
 * An element that points to the anchor of the toast.
 * Renders a `<div>` element.
 */
export const Arrow: typeof ToastArrow = ToastArrow;
export namespace Arrow {
  export type Props = ToastArrowProps;
  export type State = ToastArrowState;
}
