import PopoverArrow from './PopoverArrow.vue';
import PopoverBackdrop from './PopoverBackdrop.vue';
import PopoverClose from './PopoverClose.vue';
import PopoverDescription from './PopoverDescription.vue';
import PopoverPopup from './PopoverPopup.vue';
import PopoverPortal from './PopoverPortal.vue';
import PopoverPositioner from './PopoverPositioner.vue';
import PopoverRoot from './PopoverRoot.vue';
import PopoverTitle from './PopoverTitle.vue';
import PopoverTrigger from './PopoverTrigger.vue';
import PopoverViewport from './PopoverViewport.vue';
import type {
  PopoverArrowProps,
  PopoverArrowState,
  PopoverBackdropProps,
  PopoverBackdropState,
  PopoverCloseProps,
  PopoverCloseState,
  PopoverDescriptionProps,
  PopoverDescriptionState,
  PopoverPopupProps,
  PopoverPopupState,
  PopoverPortalProps,
  PopoverPortalState,
  PopoverPositionerProps,
  PopoverPositionerState,
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootEmits,
  PopoverRootProps,
  PopoverRootState,
  PopoverTitleProps,
  PopoverTitleState,
  PopoverTriggerProps,
  PopoverTriggerState,
  PopoverViewportProps,
  PopoverViewportState,
} from './types';

export { createHandle, PopoverHandle as Handle } from './root';

/**
 * Groups the parts of the popover.
 * Renders no element.
 */
export const Root: typeof PopoverRoot = PopoverRoot;
export namespace Root {
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Emits = PopoverRootEmits;
  export type State = PopoverRootState;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The popover is open for this trigger.
 * @selector `[data-pressed]` The popover is open for this trigger, and a press on the trigger opened it or kept it open.
 * @selector `:disabled` The trigger is a native button, and the trigger or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and it is disabled.
 */
export const Trigger: typeof PopoverTrigger = PopoverTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
  export type State = PopoverTriggerState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof PopoverPortal = PopoverPortal;
export namespace Portal {
  export type Props = PopoverPortalProps;
  export type State = PopoverPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 * @selector `[hidden]` The popover is closed, and `keepMounted` keeps the backdrop in the DOM.
 */
export const Backdrop: typeof PopoverBackdrop = PopoverBackdrop;
export namespace Backdrop {
  export type Props = PopoverBackdropProps;
  export type State = PopoverBackdropState;
}

/**
 * Places the popup at its anchor.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left` or `right`, or `inline-start` or `inline-end` for a logical `side` prop.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @cssVariable `--anchor-width` The width of the anchor, in pixels.
 * @cssVariable `--anchor-height` The height of the anchor, in pixels.
 * @cssVariable `--available-width` The width that the popup can have before it goes over the edge of the collision boundary.
 * @cssVariable `--available-height` The height that the popup can have before it goes over the edge of the collision boundary.
 * @cssVariable `--transform-origin` The point that the popup grows from, for the `transform-origin` of the popup. It is at the arrow, on the edge of the anchor. With no arrow, it is at the aligned edge of the popup or at the center of the anchor.
 * @cssVariable `--positioner-width` The width of the popup, in pixels, with a `Popover.Viewport` in the popup. During a move to another trigger, the width of the new content.
 * @cssVariable `--positioner-height` The height of the popup, in pixels, with a `Popover.Viewport` in the popup. During a move to another trigger, the height of the new content.
 */
export const Positioner: typeof PopoverPositioner = PopoverPositioner;
export namespace Positioner {
  export type Props = PopoverPositionerProps;
  export type State = PopoverPositionerState;
}

/**
 * The container of the content of the popover.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side, as on the positioner.
 * @selector `[data-instant]` An animation must not run. The value says why: `click` (a key on the trigger opened or closed the popover), `dismiss` (Escape closed it), `focus` (the focus left it) or `trigger-change` (a move to another trigger ended).
 * @selector `[hidden]` The popover is closed, and `keepMounted` keeps the popup in the DOM.
 * @cssVariable `--popup-width` The width of the popup, in pixels, during a move to another trigger with a `Popover.Viewport`: first the old width, then the new width.
 * @cssVariable `--popup-height` The height of the popup, in pixels, during a move to another trigger with a `Popover.Viewport`: first the old height, then the new height.
 */
export const Popup: typeof PopoverPopup = PopoverPopup;
export namespace Popup {
  export type Props = PopoverPopupProps;
  export type State = PopoverPopupState;
}

/**
 * An element that points to the center of the anchor.
 * Renders a `<div>` element.
 * Its place is in the padding box of its nearest positioned ancestor: the popup when the popup has a `position`, else the positioner.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side, as on the positioner.
 * @selector `[data-uncentered]` The arrow cannot point at the center of the anchor.
 */
export const Arrow: typeof PopoverArrow = PopoverArrow;
export namespace Arrow {
  export type Props = PopoverArrowProps;
  export type State = PopoverArrowState;
}

/**
 * A heading that names the popover.
 * Renders an `<h2>` element.
 */
export const Title: typeof PopoverTitle = PopoverTitle;
export namespace Title {
  export type Props = PopoverTitleProps;
  export type State = PopoverTitleState;
}

/**
 * A paragraph that describes the popover.
 * Renders a `<p>` element.
 */
export const Description: typeof PopoverDescription = PopoverDescription;
export namespace Description {
  export type Props = PopoverDescriptionProps;
  export type State = PopoverDescriptionState;
}

/**
 * A button that closes the popover.
 * Renders a `<button>` element.
 * @selector `:disabled` The button is a native button, and the button or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The button is another element, and it is disabled.
 */
export const Close: typeof PopoverClose = PopoverClose;
export namespace Close {
  export type Props = PopoverCloseProps;
  export type State = PopoverCloseState;
}

/**
 * The container of content that changes when the popover moves to another trigger.
 * Renders a `<div>` element.
 * @selector `[data-activation-direction]` The place of the new trigger from the old trigger, after a move: at most two tokens, `left` or `right` and `up` or `down`, such as `right down`.
 * @selector `[data-instant]` An animation must not run, with the values of the popup.
 */
export const Viewport: typeof PopoverViewport = PopoverViewport;
export namespace Viewport {
  export type Props = PopoverViewportProps;
  export type State = PopoverViewportState;
}
