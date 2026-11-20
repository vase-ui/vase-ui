import PreviewCardArrow from './PreviewCardArrow.vue';
import PreviewCardBackdrop from './PreviewCardBackdrop.vue';
import PreviewCardPopup from './PreviewCardPopup.vue';
import PreviewCardPortal from './PreviewCardPortal.vue';
import PreviewCardPositioner from './PreviewCardPositioner.vue';
import PreviewCardRoot from './PreviewCardRoot.vue';
import PreviewCardTrigger from './PreviewCardTrigger.vue';
import PreviewCardViewport from './PreviewCardViewport.vue';
import type {
  PreviewCardArrowProps,
  PreviewCardArrowState,
  PreviewCardBackdropProps,
  PreviewCardBackdropState,
  PreviewCardPopupProps,
  PreviewCardPopupState,
  PreviewCardPortalProps,
  PreviewCardPortalState,
  PreviewCardPositionerProps,
  PreviewCardPositionerState,
  PreviewCardRootChangeEventDetails,
  PreviewCardRootChangeEventReason,
  PreviewCardRootProps,
  PreviewCardRootState,
  PreviewCardTriggerProps,
  PreviewCardTriggerState,
  PreviewCardViewportProps,
  PreviewCardViewportState,
} from './types';

export { createHandle, PreviewCardHandle as Handle } from './root';

/**
 * Groups the parts of the preview card.
 * Renders no element.
 */
export const Root: typeof PreviewCardRoot = PreviewCardRoot;
export namespace Root {
  export type Props<Payload = unknown> = PreviewCardRootProps<Payload>;
  export type State = PreviewCardRootState;
  export type ChangeEventReason = PreviewCardRootChangeEventReason;
  export type ChangeEventDetails = PreviewCardRootChangeEventDetails;
}

/**
 * A link that opens the preview card when a mouse rests on it or a key moves the focus to it. A
 * touch opens nothing. The card takes no focus, so Tab moves from the link to the next element of
 * the page. When the link is on more than one line, the card opens at the line under the pointer.
 * Renders an `<a>` element, with no ARIA attribute, no `role` and no `tabindex`.
 * @selector `[data-popup-open]` The preview card is open for this link.
 */
export const Trigger: typeof PreviewCardTrigger = PreviewCardTrigger;
export namespace Trigger {
  export type Props<Payload = unknown> = PreviewCardTriggerProps<Payload>;
  export type State = PreviewCardTriggerState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 */
export const Portal: typeof PreviewCardPortal = PreviewCardPortal;
export namespace Portal {
  export type Props = PreviewCardPortalProps;
  export type State = PreviewCardPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 * @selector `[hidden]` The preview card is closed, and `keepMounted` keeps the backdrop in the DOM.
 */
export const Backdrop: typeof PreviewCardBackdrop = PreviewCardBackdrop;
export namespace Backdrop {
  export type Props = PreviewCardBackdropProps;
  export type State = PreviewCardBackdropState;
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
 * @cssVariable `--transform-origin` The point of the popup that faces the anchor: at the arrow, or at the aligned edge of a popup with no arrow. Give it to `transform-origin` for an animation that scales the popup.
 * @cssVariable `--positioner-width` The width of the popup, in pixels, with a `PreviewCard.Viewport` in the popup. During a move to another trigger, the width of the new content.
 * @cssVariable `--positioner-height` The height of the popup, in pixels, with a `PreviewCard.Viewport` in the popup. During a move to another trigger, the height of the new content.
 */
export const Positioner: typeof PreviewCardPositioner = PreviewCardPositioner;
export namespace Positioner {
  export type Props = PreviewCardPositionerProps;
  export type State = PreviewCardPositionerState;
}

/**
 * The container of the content of the preview card. A press in it moves the focus to it, so the
 * card stays open.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side, as on the positioner.
 * @selector `[data-instant]` An animation must not run. The value says why: `focus` (the focus opened the card) or `dismiss` (Escape closed it).
 * @selector `[hidden]` The preview card is closed, and `keepMounted` keeps the popup in the DOM.
 * @cssVariable `--popup-width` The width of the popup, in pixels, during a move to another trigger with a `PreviewCard.Viewport`: first the old width, then the new width.
 * @cssVariable `--popup-height` The height of the popup, in pixels, during a move to another trigger with a `PreviewCard.Viewport`: first the old height, then the new height.
 */
export const Popup: typeof PreviewCardPopup = PreviewCardPopup;
export namespace Popup {
  export type Props = PreviewCardPopupProps;
  export type State = PreviewCardPopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on, as on the positioner.
 * @selector `[data-align]` The alignment of the popup on its side, as on the positioner.
 * @selector `[data-uncentered]` The arrow cannot point at the center of the anchor.
 */
export const Arrow: typeof PreviewCardArrow = PreviewCardArrow;
export namespace Arrow {
  export type Props = PreviewCardArrowProps;
  export type State = PreviewCardArrowState;
}

/**
 * The container of content that changes when the preview card moves to another trigger.
 * Renders a `<div>` element.
 * @selector `[data-activation-direction]` The place of the new trigger from the old trigger, after a move: at most two tokens, `left` or `right` and `up` or `down`, such as `right down`.
 * @selector `[data-instant]` An animation must not run, with the values of the popup.
 */
export const Viewport: typeof PreviewCardViewport = PreviewCardViewport;
export namespace Viewport {
  export type Props = PreviewCardViewportProps;
  export type State = PreviewCardViewportState;
}
