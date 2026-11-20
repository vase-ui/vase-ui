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
 * A link that opens the preview card when a mouse rests on it or the keyboard moves the focus to it.
 * Renders an `<a>` element.
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
 */
export const Backdrop: typeof PreviewCardBackdrop = PreviewCardBackdrop;
export namespace Backdrop {
  export type Props = PreviewCardBackdropProps;
  export type State = PreviewCardBackdropState;
}

/**
 * Places the popup at its anchor.
 * Renders a `<div>` element.
 */
export const Positioner: typeof PreviewCardPositioner = PreviewCardPositioner;
export namespace Positioner {
  export type Props = PreviewCardPositionerProps;
  export type State = PreviewCardPositionerState;
}

/**
 * The container of the content of the preview card.
 * Renders a `<div>` element.
 */
export const Popup: typeof PreviewCardPopup = PreviewCardPopup;
export namespace Popup {
  export type Props = PreviewCardPopupProps;
  export type State = PreviewCardPopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof PreviewCardArrow = PreviewCardArrow;
export namespace Arrow {
  export type Props = PreviewCardArrowProps;
  export type State = PreviewCardArrowState;
}

/**
 * The container of content that changes when the preview card moves to another trigger.
 * Renders a `<div>` element.
 */
export const Viewport: typeof PreviewCardViewport = PreviewCardViewport;
export namespace Viewport {
  export type Props = PreviewCardViewportProps;
  export type State = PreviewCardViewportState;
}
