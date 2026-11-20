import DialogClose from '../dialog/DialogClose.vue';
import DialogDescription from '../dialog/DialogDescription.vue';
import DialogPortal from '../dialog/DialogPortal.vue';
import DialogTitle from '../dialog/DialogTitle.vue';
import DrawerBackdrop from './DrawerBackdrop.vue';
import DrawerContent from './DrawerContent.vue';
import DrawerIndent from './DrawerIndent.vue';
import DrawerIndentBackground from './DrawerIndentBackground.vue';
import DrawerPopup from './DrawerPopup.vue';
import DrawerProvider from './DrawerProvider.vue';
import DrawerRoot from './DrawerRoot.vue';
import DrawerSwipeArea from './DrawerSwipeArea.vue';
import DrawerTrigger from './DrawerTrigger.vue';
import DrawerViewport from './DrawerViewport.vue';
import DrawerVirtualKeyboardProvider from './DrawerVirtualKeyboardProvider.vue';
import type {
  DrawerBackdropProps,
  DrawerBackdropState,
  DrawerCloseProps,
  DrawerCloseState,
  DrawerContentProps,
  DrawerContentState,
  DrawerDescriptionProps,
  DrawerDescriptionState,
  DrawerIndentBackgroundProps,
  DrawerIndentBackgroundState,
  DrawerIndentProps,
  DrawerIndentState,
  DrawerPopupProps,
  DrawerPopupState,
  DrawerPortalProps,
  DrawerPortalState,
  DrawerProviderProps,
  DrawerProviderState,
  DrawerRootChangeEventDetails,
  DrawerRootChangeEventReason,
  DrawerRootProps,
  DrawerRootSnapPointChangeEventDetails,
  DrawerRootSnapPointChangeEventReason,
  DrawerRootState,
  DrawerSnapPoint,
  DrawerSwipeAreaProps,
  DrawerSwipeAreaState,
  DrawerTitleProps,
  DrawerTitleState,
  DrawerTriggerProps,
  DrawerTriggerState,
  DrawerViewportProps,
  DrawerViewportState,
  DrawerVirtualKeyboardProviderProps,
  DrawerVirtualKeyboardProviderState,
} from './types';

export { createHandle, DrawerHandle as Handle } from './root';

/**
 * Groups the parts of the drawer.
 * Renders no element.
 */
export const Root: typeof DrawerRoot = DrawerRoot;
export namespace Root {
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type State = DrawerRootState;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = DrawerSnapPoint;
}

/**
 * A button that opens the drawer.
 * Renders a `<button>` element.
 */
export const Trigger: typeof DrawerTrigger = DrawerTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = DrawerTriggerProps<Payload>;
  export type State = DrawerTriggerState;
}

/**
 * An area where a swipe opens the drawer.
 * Renders a `<div>` element.
 */
export const SwipeArea: typeof DrawerSwipeArea = DrawerSwipeArea;
export namespace SwipeArea {
  export type Props = DrawerSwipeAreaProps;
  export type State = DrawerSwipeAreaState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof DialogPortal = DialogPortal;
export namespace Portal {
  export type Props = DrawerPortalProps;
  export type State = DrawerPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof DrawerBackdrop = DrawerBackdrop;
export namespace Backdrop {
  export type Props = DrawerBackdropProps;
  export type State = DrawerBackdropState;
}

/**
 * The container of the popup, where a swipe moves it.
 * Renders a `<div>` element.
 */
export const Viewport: typeof DrawerViewport = DrawerViewport;
export namespace Viewport {
  export type Props = DrawerViewportProps;
  export type State = DrawerViewportState;
}

/**
 * The container of the content of the drawer.
 * Renders a `<div>` element.
 */
export const Popup: typeof DrawerPopup = DrawerPopup;
export namespace Popup {
  export type Props = DrawerPopupProps;
  export type State = DrawerPopupState;
}

/**
 * The content of the popup, where a mouse selects text and starts no swipe.
 * Renders a `<div>` element.
 */
export const Content: typeof DrawerContent = DrawerContent;
export namespace Content {
  export type Props = DrawerContentProps;
  export type State = DrawerContentState;
}

/**
 * A heading that names the drawer.
 * Renders an `<h2>` element.
 */
export const Title: typeof DialogTitle = DialogTitle;
export namespace Title {
  export type Props = DrawerTitleProps;
  export type State = DrawerTitleState;
}

/**
 * A paragraph that describes the drawer.
 * Renders a `<p>` element.
 */
export const Description: typeof DialogDescription = DialogDescription;
export namespace Description {
  export type Props = DrawerDescriptionProps;
  export type State = DrawerDescriptionState;
}

/**
 * A button that closes the drawer.
 * Renders a `<button>` element.
 */
export const Close: typeof DialogClose = DialogClose;
export namespace Close {
  export type Props = DrawerCloseProps;
  export type State = DrawerCloseState;
}

/**
 * Gives the open state of its drawers to the indent parts.
 * Renders no element.
 */
export const Provider: typeof DrawerProvider = DrawerProvider;
export namespace Provider {
  export type Props = DrawerProviderProps;
  export type State = DrawerProviderState;
}

/**
 * A container of the page that moves back while a drawer is open.
 * Renders a `<div>` element.
 */
export const Indent: typeof DrawerIndent = DrawerIndent;
export namespace Indent {
  export type Props = DrawerIndentProps;
  export type State = DrawerIndentState;
}

/**
 * A layer under the indent.
 * Renders a `<div>` element.
 */
export const IndentBackground: typeof DrawerIndentBackground = DrawerIndentBackground;
export namespace IndentBackground {
  export type Props = DrawerIndentBackgroundProps;
  export type State = DrawerIndentBackgroundState;
}

/**
 * Keeps a focused text field of the drawer above the software keyboard.
 * Renders no element.
 */
export const VirtualKeyboardProvider: typeof DrawerVirtualKeyboardProvider =
  DrawerVirtualKeyboardProvider;
export namespace VirtualKeyboardProvider {
  export type Props = DrawerVirtualKeyboardProviderProps;
  export type State = DrawerVirtualKeyboardProviderState;
}
