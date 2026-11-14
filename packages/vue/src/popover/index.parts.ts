import PopoverArrow from './arrow/PopoverArrow.vue';
import type { PopoverArrowProps, PopoverArrowState } from './arrow/PopoverArrow.vue';
import PopoverBackdrop from './backdrop/PopoverBackdrop.vue';
import type { PopoverBackdropProps, PopoverBackdropState } from './backdrop/PopoverBackdrop.vue';
import PopoverClose from './close/PopoverClose.vue';
import type { PopoverCloseProps, PopoverCloseState } from './close/PopoverClose.vue';
import PopoverDescription from './description/PopoverDescription.vue';
import type {
  PopoverDescriptionProps,
  PopoverDescriptionState,
} from './description/PopoverDescription.vue';
import PopoverPopup from './popup/PopoverPopup.vue';
import type { PopoverPopupProps, PopoverPopupState } from './popup/PopoverPopup.vue';
import PopoverPortal from './portal/PopoverPortal.vue';
import type { PopoverPortalProps, PopoverPortalState } from './portal/PopoverPortal.vue';
import PopoverPositioner from './positioner/PopoverPositioner.vue';
import type {
  PopoverPositionerProps,
  PopoverPositionerState,
} from './positioner/PopoverPositioner.vue';
import PopoverRoot from './root/PopoverRoot.vue';
import type {
  PopoverRootActions,
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootProps,
  PopoverRootState,
} from './root/PopoverRoot.vue';
import PopoverTitle from './title/PopoverTitle.vue';
import type { PopoverTitleProps, PopoverTitleState } from './title/PopoverTitle.vue';
import PopoverTrigger from './trigger/PopoverTrigger.vue';
import type { PopoverTriggerProps, PopoverTriggerState } from './trigger/PopoverTrigger.vue';

/**
 * Groups all parts of the popover.
 * Doesn't render its own HTML element.
 */
export const Root: typeof PopoverRoot = PopoverRoot;
export namespace Root {
  export type State = PopoverRootState;
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Actions = PopoverRootActions;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 */
export const Trigger: typeof PopoverTrigger = PopoverTrigger;
export namespace Trigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof PopoverPortal = PopoverPortal;
export namespace Portal {
  export type State = PopoverPortalState;
  export type Props = PopoverPortalProps;
}

/**
 * Positions the popover against the trigger.
 * Renders a `<div>` element.
 */
export const Positioner: typeof PopoverPositioner = PopoverPositioner;
export namespace Positioner {
  export type State = PopoverPositionerState;
  export type Props = PopoverPositionerProps;
}

/**
 * A container for the popover contents.
 * Renders a `<div>` element.
 */
export const Popup: typeof PopoverPopup = PopoverPopup;
export namespace Popup {
  export type State = PopoverPopupState;
  export type Props = PopoverPopupProps;
}

/**
 * Displays an element positioned against the popover anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof PopoverArrow = PopoverArrow;
export namespace Arrow {
  export type State = PopoverArrowState;
  export type Props = PopoverArrowProps;
}

/**
 * An overlay displayed beneath the popover.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof PopoverBackdrop = PopoverBackdrop;
export namespace Backdrop {
  export type State = PopoverBackdropState;
  export type Props = PopoverBackdropProps;
}

/**
 * A heading that labels the popover.
 * Renders an `<h2>` element.
 */
export const Title: typeof PopoverTitle = PopoverTitle;
export namespace Title {
  export type State = PopoverTitleState;
  export type Props = PopoverTitleProps;
}

/**
 * A paragraph with additional information about the popover.
 * Renders a `<p>` element.
 */
export const Description: typeof PopoverDescription = PopoverDescription;
export namespace Description {
  export type State = PopoverDescriptionState;
  export type Props = PopoverDescriptionProps;
}

/**
 * A button that closes the popover.
 * Renders a `<button>` element.
 */
export const Close: typeof PopoverClose = PopoverClose;
export namespace Close {
  export type State = PopoverCloseState;
  export type Props = PopoverCloseProps;
}

export {
  createPopoverHandle as createHandle,
  PopoverHandle as Handle,
} from './store/PopoverHandle';
