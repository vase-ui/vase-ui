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
  export type State = PopoverRootState;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
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
 */
export const Backdrop: typeof PopoverBackdrop = PopoverBackdrop;
export namespace Backdrop {
  export type Props = PopoverBackdropProps;
  export type State = PopoverBackdropState;
}

/**
 * Places the popup at its anchor.
 * Renders a `<div>` element.
 */
export const Positioner: typeof PopoverPositioner = PopoverPositioner;
export namespace Positioner {
  export type Props = PopoverPositionerProps;
  export type State = PopoverPositionerState;
}

/**
 * The container of the content of the popover.
 * Renders a `<div>` element.
 */
export const Popup: typeof PopoverPopup = PopoverPopup;
export namespace Popup {
  export type Props = PopoverPopupProps;
  export type State = PopoverPopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
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
 */
export const Close: typeof PopoverClose = PopoverClose;
export namespace Close {
  export type Props = PopoverCloseProps;
  export type State = PopoverCloseState;
}

/**
 * The container of content that changes when the popover moves to another trigger.
 * Renders a `<div>` element.
 */
export const Viewport: typeof PopoverViewport = PopoverViewport;
export namespace Viewport {
  export type Props = PopoverViewportProps;
  export type State = PopoverViewportState;
}
