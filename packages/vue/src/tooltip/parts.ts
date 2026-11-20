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
 * Gives one delay to the tooltips in it. After one of them opened, the others open at once.
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
 * The element that the tooltip describes. A hover and the focus of a key open the tooltip.
 * Renders a `<button>` element.
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
 */
export const Positioner: typeof TooltipPositioner = TooltipPositioner;
export namespace Positioner {
  export type Props = TooltipPositionerProps;
  export type State = TooltipPositionerState;
}

/**
 * The container of the content of the tooltip.
 * Renders a `<div>` element.
 */
export const Popup: typeof TooltipPopup = TooltipPopup;
export namespace Popup {
  export type Props = TooltipPopupProps;
  export type State = TooltipPopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof TooltipArrow = TooltipArrow;
export namespace Arrow {
  export type Props = TooltipArrowProps;
  export type State = TooltipArrowState;
}

/**
 * The container of content that changes when the tooltip moves to another trigger.
 * Renders a `<div>` element.
 */
export const Viewport: typeof TooltipViewport = TooltipViewport;
export namespace Viewport {
  export type Props = TooltipViewportProps;
  export type State = TooltipViewportState;
}
