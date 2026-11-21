import TooltipArrow from './TooltipArrow.vue';
import TooltipPopup from './TooltipPopup.vue';
import TooltipPortal from './TooltipPortal.vue';
import TooltipPositioner from './TooltipPositioner.vue';
import TooltipProvider from './TooltipProvider.vue';
import TooltipRoot from './TooltipRoot.vue';
import TooltipTrigger from './TooltipTrigger.vue';
import TooltipViewport from './TooltipViewport.vue';
import type {
  TooltipArrowProps,
  TooltipArrowState,
  TooltipPopupProps,
  TooltipPopupState,
  TooltipPortalProps,
  TooltipPortalState,
  TooltipPositionerProps,
  TooltipPositionerState,
  TooltipProviderProps,
  TooltipProviderState,
  TooltipRootChangeEventDetails,
  TooltipRootChangeEventReason,
  TooltipRootProps,
  TooltipRootState,
  TooltipTriggerProps,
  TooltipTriggerState,
  TooltipViewportProps,
  TooltipViewportState,
} from './types';

export { createHandle, TooltipHandle as Handle } from './root';

/**
 * Makes the tooltips in it one group. One tooltip of a group is open at a time. While one is open,
 * and for `timeout` after its close, a hover opens another tooltip of the group at once. The
 * tooltips with no provider are one more group, in which each tooltip waits for its delay.
 * Renders no element.
 */
export const Provider: typeof TooltipProvider = TooltipProvider;
export namespace Provider {
  export type Props = TooltipProviderProps;
  export type State = TooltipProviderState;
}

/**
 * Groups the parts of the tooltip.
 * Renders no element.
 */
export const Root: typeof TooltipRoot = TooltipRoot;
export namespace Root {
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type State = TooltipRootState;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}

/**
 * The element that the tooltip describes. A mouse that rests on it opens the tooltip after the
 * delay, and the focus of a key opens it at once. A touch opens no tooltip. The tooltip of a
 * disabled button also opens at a hover, so it can tell why the button is disabled. A trigger in
 * another trigger opens only its own tooltip.
 * Renders a `<button>` element.
 * @selector `[data-popup-open]` The tooltip is open for this trigger.
 * @selector `[data-trigger-disabled]` The tooltip does not open from this trigger, because the trigger or the root is disabled.
 */
export const Trigger: typeof TooltipTrigger = TooltipTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
  export type State = TooltipTriggerState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof TooltipPortal = TooltipPortal;
export namespace Portal {
  export type Props = TooltipPortalProps;
  export type State = TooltipPortalState;
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
 * @cssVariable `--positioner-width` The width of the popup, in pixels, with a `Tooltip.Viewport` in the popup. During a move to another trigger, the width of the new content.
 * @cssVariable `--positioner-height` The height of the popup, in pixels, with a `Tooltip.Viewport` in the popup. During a move to another trigger, the height of the new content.
 */
export const Positioner: typeof TooltipPositioner = TooltipPositioner;
export namespace Positioner {
  export type Props = TooltipPositionerProps;
  export type State = TooltipPositionerState;
}

/**
 * The container of the content of the tooltip. It has no `role` and does not describe the trigger.
 * To describe the trigger with it, set `keepMounted` on `Tooltip.Portal`, give the popup
 * `role="tooltip"` and an `id`, and give the trigger `aria-describedby` with that `id`.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side, as on the positioner.
 * @selector `[data-instant]` An animation must not run. The value says why: `delay` (the tooltip opened while another tooltip of its group was open or in the `timeout` after its close, or it closed because another tooltip of the group opened or its active trigger left the DOM), `focus` (the focus opened it) or `dismiss` (Escape or a press on the trigger closed it).
 * @selector `[hidden]` The tooltip is closed, and `keepMounted` keeps the popup in the DOM.
 * @cssVariable `--popup-width` The width of the popup, in pixels, during a move to another trigger with a `Tooltip.Viewport`: first the old width, then the new width.
 * @cssVariable `--popup-height` The height of the popup, in pixels, during a move to another trigger with a `Tooltip.Viewport`: first the old height, then the new height.
 */
export const Popup: typeof TooltipPopup = TooltipPopup;
export namespace Popup {
  export type Props = TooltipPopupProps;
  export type State = TooltipPopupState;
}

/**
 * An element that points to the center of the anchor.
 * Renders a `<div>` element.
 * Its place is in the padding box of its nearest positioned ancestor: the popup when the popup has a `position`, else the positioner.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side, as on the positioner.
 * @selector `[data-uncentered]` The arrow cannot point at the center of the anchor.
 * @selector `[data-instant]` An animation must not run, with the values of the popup.
 */
export const Arrow: typeof TooltipArrow = TooltipArrow;
export namespace Arrow {
  export type Props = TooltipArrowProps;
  export type State = TooltipArrowState;
}

/**
 * The container of content that changes when the tooltip moves to another trigger.
 * Renders a `<div>` element.
 * @selector `[data-activation-direction]` The place of the new trigger from the old trigger, after a move: at most two tokens, `left` or `right` and `up` or `down`, such as `right down`.
 * @selector `[data-instant]` An animation must not run, with the values of the popup.
 */
export const Viewport: typeof TooltipViewport = TooltipViewport;
export namespace Viewport {
  export type Props = TooltipViewportProps;
  export type State = TooltipViewportState;
}
