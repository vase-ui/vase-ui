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
  DrawerRootEmits,
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
  export type Emits = DrawerRootEmits;
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
 * @selector `[aria-expanded="true"]` The drawer is open for this trigger.
 * @selector `:disabled` The trigger is a native button, and it or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and it is disabled.
 */
export const Trigger: typeof DrawerTrigger = DrawerTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = DrawerTriggerProps<Payload>;
  export type State = DrawerTriggerState;
}

/**
 * An area where a swipe opens the drawer.
 * Renders a `<div>` element.
 * @selector `[data-open]` The drawer is open.
 * @selector `[data-swiping]` A swipe on the area moves the drawer.
 * @selector `[data-swipe-direction]` The direction of the swipe that opens the drawer: `up`, `down`, `left` or `right`.
 * @selector `[data-disabled]` A swipe on the area opens nothing.
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
 * @selector `[hidden]` The drawer is closed, and `keepMounted` of the portal keeps the backdrop in the DOM.
 * @selector `[data-swiping]` A swipe moves the popup.
 * @selector `[data-swipe-dismiss]` The backdrop leaves after a swipe on the popup closed the drawer.
 * @cssVariable `--drawer-swipe-progress` The progress of the popup toward its closed place: 0 at the open place, 1 at the closed place. A swipe or the active snap point sets it.
 * @cssVariable `--drawer-swipe-strength` A number from 0.1 to 1 that scales the duration of the leave after a swipe. A faster swipe gives a smaller number. It is 1 at other times.
 * @cssVariable `--drawer-height` The height of the frontmost drawer, in pixels, while `--drawer-swipe-progress` is above 0 and that drawer has a height.
 */
export const Backdrop: typeof DrawerBackdrop = DrawerBackdrop;
export namespace Backdrop {
  export type Props = DrawerBackdropProps;
  export type State = DrawerBackdropState;
}

/**
 * The container of the popup, where a swipe moves it. At its first move of 6 px, a touch drag goes
 * to the swipe or stays with the browser. A move that is more across the axis of the drawer than
 * along it stays with the browser. In a scroller on that axis, the swipe takes the drag only at the
 * edge of the scroller, for a move toward the closed place. A touch can start a swipe on a control
 * or in `Drawer.Content`. It starts none on a range input, or while the popup has a text selection.
 * A touch that starts outside the popup moves it from the point where the finger comes into it. A
 * mouse or a pen starts a swipe only in the popup. It starts none on a control, in `Drawer.Content`
 * or in a scroller on the axis. An element with `data-vase-ui-swipe-ignore` starts no swipe. With
 * the value `x` or `y`, the element takes the touch drags on that axis, and a touch drag on the
 * other axis still swipes the drawer.
 * Renders a `<div>` element.
 * @selector `[hidden]` The drawer is closed, and `keepMounted` of the portal keeps the viewport in the DOM.
 * @selector `[data-nested]` The root of the drawer is inside a `Dialog.Root`, an `AlertDialog.Root` or a `Drawer.Root`.
 * @selector `:has(> .v-leave-active)` The popup leaves. Use the leave class of the `<Transition>` around the popup.
 * @cssVariable `--drawer-keyboard-inset` The height of the software keyboard over the bottom of the layout viewport, in pixels. `Drawer.VirtualKeyboardProvider` sets it only while a field of the drawer has the focus and the keyboard covers the layout viewport.
 */
export const Viewport: typeof DrawerViewport = DrawerViewport;
export namespace Viewport {
  export type Props = DrawerViewportProps;
  export type State = DrawerViewportState;
}

/**
 * The container of the content of the drawer.
 * Renders a `<div>` element.
 * @selector `[hidden]` The drawer is closed, and `keepMounted` of the portal keeps the popup in the DOM.
 * @selector `[data-expanded]` The drawer is at the snap point `1`.
 * @selector `[data-nested-drawer-open]` A drawer in this drawer is open.
 * @selector `[data-nested-drawer-swiping]` A swipe moves a drawer in this drawer by 10 px or more.
 * @selector `[data-swipe-direction]` The direction of the swipe that closes the drawer: `up`, `down`, `left` or `right`.
 * @selector `[data-swiping]` A swipe moves the popup.
 * @selector `[data-swipe-dismiss]` The popup leaves after a swipe on it closed the drawer.
 * @cssVariable `--nested-drawers` The number of open drawers in this drawer, at each depth. The frontmost drawer has 0.
 * @cssVariable `--drawer-height` The height of the popup, in pixels, while a drawer in this drawer is open or leaves.
 * @cssVariable `--drawer-frontmost-height` The height of the frontmost open drawer, in pixels, while a drawer in this drawer is open.
 * @cssVariable `--drawer-snap-point-offset` The distance from the open place to the active snap point, in pixels. It is negative for a drawer that closes up, and 0 with no snap point.
 * @cssVariable `--drawer-swipe-movement-x` The movement of the popup on the x axis during a swipe, in pixels.
 * @cssVariable `--drawer-swipe-movement-y` The movement of the popup on the y axis during a swipe, in pixels.
 * @cssVariable `--drawer-swipe-strength` A number from 0.1 to 1 that scales the duration of the leave after a swipe. A faster swipe gives a smaller number. It is 1 at other times.
 * @cssVariable `--drawer-swipe-progress` The progress of the swipe of a drawer in this drawer: 0 at its open place, 1 at its closed place.
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
 * @selector `:disabled` The button is a native button, and it or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The button is another element, and it is disabled.
 */
export const Close: typeof DialogClose = DialogClose;
export namespace Close {
  export type Props = DrawerCloseProps;
  export type State = DrawerCloseState;
}

/**
 * Gives the open state of its drawers to the indent parts. The indent parts are not active in the
 * server HTML. They become active after the mount of an open root.
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
 * @selector `[data-active]` A drawer of the provider is open.
 * @cssVariable `--drawer-swipe-progress` The progress of the outer drawer toward its closed place: 0 at the open place, 1 at the closed place.
 * @cssVariable `--drawer-height` The height of the frontmost drawer, in pixels, while `--drawer-swipe-progress` is above 0 and that drawer has a height.
 */
export const Indent: typeof DrawerIndent = DrawerIndent;
export namespace Indent {
  export type Props = DrawerIndentProps;
  export type State = DrawerIndentState;
}

/**
 * A layer under the indent.
 * Renders a `<div>` element.
 * @selector `[data-active]` A drawer of the provider is open.
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
