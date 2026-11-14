import DrawerBackdrop from './backdrop/DrawerBackdrop.vue';
import type { DrawerBackdropProps, DrawerBackdropState } from './backdrop/DrawerBackdrop.vue';
import { DrawerClose } from './close/DrawerClose';
import type { DrawerCloseProps, DrawerCloseState } from './close/DrawerClose';
import DrawerContent from './content/DrawerContent.vue';
import type { DrawerContentProps, DrawerContentState } from './content/DrawerContent.vue';
import { DrawerDescription } from './description/DrawerDescription';
import type {
  DrawerDescriptionProps,
  DrawerDescriptionState,
} from './description/DrawerDescription';
import DrawerIndentBackground from './indent-background/DrawerIndentBackground.vue';
import type {
  DrawerIndentBackgroundProps,
  DrawerIndentBackgroundState,
} from './indent-background/DrawerIndentBackground.vue';
import DrawerIndent from './indent/DrawerIndent.vue';
import type { DrawerIndentProps, DrawerIndentState } from './indent/DrawerIndent.vue';
import DrawerPopup from './popup/DrawerPopup.vue';
import type { DrawerPopupProps, DrawerPopupState } from './popup/DrawerPopup.vue';
import { DrawerPortal } from './portal/DrawerPortal';
import type { DrawerPortalProps, DrawerPortalState } from './portal/DrawerPortal';
import DrawerProvider from './provider/DrawerProvider.vue';
import type { DrawerProviderProps, DrawerProviderState } from './provider/DrawerProvider.vue';
import DrawerRoot from './root/DrawerRoot.vue';
import type {
  DrawerRootActions,
  DrawerRootChangeEventDetails,
  DrawerRootChangeEventReason,
  DrawerRootProps,
  DrawerRootSnapPointChangeEventDetails,
  DrawerRootSnapPointChangeEventReason,
  DrawerRootState,
} from './root/DrawerRoot.vue';
import type { DrawerSnapPoint } from './root/DrawerRootContext';
import DrawerSwipeArea from './swipe-area/DrawerSwipeArea.vue';
import type { DrawerSwipeAreaProps, DrawerSwipeAreaState } from './swipe-area/DrawerSwipeArea.vue';
import { DrawerTitle } from './title/DrawerTitle';
import type { DrawerTitleProps, DrawerTitleState } from './title/DrawerTitle';
import DrawerTrigger from './trigger/DrawerTrigger.vue';
import type { DrawerTriggerProps, DrawerTriggerState } from './trigger/DrawerTrigger.vue';
import DrawerViewport from './viewport/DrawerViewport.vue';
import type { DrawerViewportProps, DrawerViewportState } from './viewport/DrawerViewport.vue';
import DrawerVirtualKeyboardProvider from './virtual-keyboard-provider/DrawerVirtualKeyboardProvider.vue';
import type {
  DrawerVirtualKeyboardProviderProps,
  DrawerVirtualKeyboardProviderState,
} from './virtual-keyboard-provider/DrawerVirtualKeyboardProvider.vue';

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof DrawerBackdrop = DrawerBackdrop;
export namespace Backdrop {
  export type Props = DrawerBackdropProps;
  export type State = DrawerBackdropState;
}

/**
 * A button that closes the drawer.
 * Renders a `<button>` element.
 */
export const Close: typeof DrawerClose = DrawerClose;
export namespace Close {
  export type Props = DrawerCloseProps;
  export type State = DrawerCloseState;
}

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 */
export const Content: typeof DrawerContent = DrawerContent;
export namespace Content {
  export type Props = DrawerContentProps;
  export type State = DrawerContentState;
}

/**
 * A paragraph with additional information about the drawer.
 * Renders a `<p>` element.
 */
export const Description: typeof DrawerDescription = DrawerDescription;
export namespace Description {
  export type Props = DrawerDescriptionProps;
  export type State = DrawerDescriptionState;
}

/**
 * A wrapper element intended to contain your app's main UI.
 * Applies `data-active` when any drawer within the nearest `<Drawer.Provider>` is open.
 * Renders a `<div>` element.
 */
export const Indent: typeof DrawerIndent = DrawerIndent;
export namespace Indent {
  export type State = DrawerIndentState;
  export type Props = DrawerIndentProps;
}

/**
 * An element placed before `<Drawer.Indent>` to render a background layer that can be styled based on whether any drawer is open.
 * Renders a `<div>` element.
 */
export const IndentBackground: typeof DrawerIndentBackground = DrawerIndentBackground;
export namespace IndentBackground {
  export type State = DrawerIndentBackgroundState;
  export type Props = DrawerIndentBackgroundProps;
}

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 */
export const Popup: typeof DrawerPopup = DrawerPopup;
export namespace Popup {
  export type Props = DrawerPopupProps;
  export type State = DrawerPopupState;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof DrawerPortal = DrawerPortal;
export namespace Portal {
  export type Props = DrawerPortalProps;
  export type State = DrawerPortalState;
}

/**
 * Provides a shared context for coordinating global Drawer UI, such as indent/background effects based on whether any Drawer is open.
 * Doesn't render its own HTML element.
 */
export const Provider: typeof DrawerProvider = DrawerProvider;
export namespace Provider {
  export type State = DrawerProviderState;
  export type Props = DrawerProviderProps;
}

/**
 * Groups all parts of the drawer.
 * Doesn't render its own HTML element.
 */
export const Root: typeof DrawerRoot = DrawerRoot;
export namespace Root {
  export type State = DrawerRootState;
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type Actions = DrawerRootActions;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = DrawerSnapPoint;
}

/**
 * An invisible area that listens for swipe gestures to open the drawer.
 * Renders a `<div>` element.
 */
export const SwipeArea: typeof DrawerSwipeArea = DrawerSwipeArea;
export namespace SwipeArea {
  export type Props = DrawerSwipeAreaProps;
  export type State = DrawerSwipeAreaState;
}

/**
 * A heading that labels the drawer.
 * Renders an `<h2>` element.
 */
export const Title: typeof DrawerTitle = DrawerTitle;
export namespace Title {
  export type Props = DrawerTitleProps;
  export type State = DrawerTitleState;
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
 * A positioning container for the drawer popup that can be made scrollable.
 * Renders a `<div>` element.
 */
export const Viewport: typeof DrawerViewport = DrawerViewport;
export namespace Viewport {
  export type Props = DrawerViewportProps;
  export type State = DrawerViewportState;
}

/**
 * Provides keyboard-aware focus and scroll handling for bottom-sheet drawers with form fields.
 */
export const VirtualKeyboardProvider: typeof DrawerVirtualKeyboardProvider =
  DrawerVirtualKeyboardProvider;
export namespace VirtualKeyboardProvider {
  export type State = DrawerVirtualKeyboardProviderState;
  export type Props = DrawerVirtualKeyboardProviderProps;
}

export { createDrawerHandle as createHandle, DrawerHandle as Handle } from './handle';
