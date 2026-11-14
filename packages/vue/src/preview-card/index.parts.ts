import PreviewCardArrow from './arrow/PreviewCardArrow.vue';
import type { PreviewCardArrowProps, PreviewCardArrowState } from './arrow/PreviewCardArrow.vue';
import PreviewCardBackdrop from './backdrop/PreviewCardBackdrop.vue';
import type {
  PreviewCardBackdropProps,
  PreviewCardBackdropState,
} from './backdrop/PreviewCardBackdrop.vue';
import PreviewCardPopup from './popup/PreviewCardPopup.vue';
import type { PreviewCardPopupProps, PreviewCardPopupState } from './popup/PreviewCardPopup.vue';
import PreviewCardPortal from './portal/PreviewCardPortal.vue';
import type {
  PreviewCardPortalProps,
  PreviewCardPortalState,
} from './portal/PreviewCardPortal.vue';
import PreviewCardPositioner from './positioner/PreviewCardPositioner.vue';
import type {
  PreviewCardPositionerProps,
  PreviewCardPositionerState,
} from './positioner/PreviewCardPositioner.vue';
import PreviewCardRoot from './root/PreviewCardRoot.vue';
import type {
  PreviewCardRootActions,
  PreviewCardRootChangeEventDetails,
  PreviewCardRootChangeEventReason,
  PreviewCardRootProps,
  PreviewCardRootState,
} from './root/PreviewCardRoot.vue';
import PreviewCardTrigger from './trigger/PreviewCardTrigger.vue';
import type {
  PreviewCardTriggerProps,
  PreviewCardTriggerState,
} from './trigger/PreviewCardTrigger.vue';
import PreviewCardViewport from './viewport/PreviewCardViewport.vue';
import type {
  PreviewCardViewportProps,
  PreviewCardViewportState,
} from './viewport/PreviewCardViewport.vue';

/**
 * Groups all parts of the preview card.
 * Doesn't render its own HTML element.
 */
export const Root: typeof PreviewCardRoot = PreviewCardRoot;
export namespace Root {
  export type State = PreviewCardRootState;
  export type Props<Payload = unknown> = PreviewCardRootProps<Payload>;
  export type Actions = PreviewCardRootActions;
  export type ChangeEventReason = PreviewCardRootChangeEventReason;
  export type ChangeEventDetails = PreviewCardRootChangeEventDetails;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof PreviewCardPortal = PreviewCardPortal;
export namespace Portal {
  export type State = PreviewCardPortalState;
  export type Props = PreviewCardPortalProps;
}

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 */
export const Trigger: typeof PreviewCardTrigger = PreviewCardTrigger;
export namespace Trigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown> = PreviewCardTriggerProps<Payload>;
}

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 */
export const Positioner: typeof PreviewCardPositioner = PreviewCardPositioner;
export namespace Positioner {
  export type State = PreviewCardPositionerState;
  export type Props = PreviewCardPositionerProps;
}

/**
 * A container for the preview card contents.
 * Renders a `<div>` element.
 */
export const Popup: typeof PreviewCardPopup = PreviewCardPopup;
export namespace Popup {
  export type State = PreviewCardPopupState;
  export type Props = PreviewCardPopupProps;
}

/**
 * Displays an element positioned against the preview card anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof PreviewCardArrow = PreviewCardArrow;
export namespace Arrow {
  export type State = PreviewCardArrowState;
  export type Props = PreviewCardArrowProps;
}

/**
 * A presentational overlay displayed beneath the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof PreviewCardBackdrop = PreviewCardBackdrop;
export namespace Backdrop {
  export type State = PreviewCardBackdropState;
  export type Props = PreviewCardBackdropProps;
}

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content
 * changes based on the trigger, and switching between them is animated.
 * Renders a `<div>` element.
 */
export const Viewport: typeof PreviewCardViewport = PreviewCardViewport;
export namespace Viewport {
  export type State = PreviewCardViewportState;
  export type Props = PreviewCardViewportProps;
}

export {
  createPreviewCardHandle as createHandle,
  PreviewCardHandle as Handle,
} from './store/PreviewCardHandle';
