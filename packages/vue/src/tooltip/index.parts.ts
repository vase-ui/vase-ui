import TooltipArrow from './arrow/TooltipArrow.vue';
import type { TooltipArrowProps, TooltipArrowState } from './arrow/TooltipArrow.vue';
import TooltipPopup from './popup/TooltipPopup.vue';
import type { TooltipPopupProps, TooltipPopupState } from './popup/TooltipPopup.vue';
import TooltipPortal from './portal/TooltipPortal.vue';
import type { TooltipPortalProps, TooltipPortalState } from './portal/TooltipPortal.vue';
import TooltipPositioner from './positioner/TooltipPositioner.vue';
import type {
  TooltipPositionerProps,
  TooltipPositionerState,
} from './positioner/TooltipPositioner.vue';
import TooltipProvider from './provider/TooltipProvider.vue';
import type { TooltipProviderProps, TooltipProviderState } from './provider/TooltipProvider.vue';
import TooltipRoot from './root/TooltipRoot.vue';
import type {
  TooltipRootActions,
  TooltipRootChangeEventDetails,
  TooltipRootChangeEventReason,
  TooltipRootProps,
  TooltipRootState,
} from './root/TooltipRoot.vue';
import TooltipTrigger from './trigger/TooltipTrigger.vue';
import type { TooltipTriggerProps, TooltipTriggerState } from './trigger/TooltipTrigger.vue';

/**
 * Groups all parts of the tooltip.
 * Doesn't render its own HTML element.
 */
export const Root: typeof TooltipRoot = TooltipRoot;
export namespace Root {
  export type State = TooltipRootState;
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type Actions = TooltipRootActions;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 */
export const Trigger: typeof TooltipTrigger = TooltipTrigger;
export namespace Trigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof TooltipPortal = TooltipPortal;
export namespace Portal {
  export type State = TooltipPortalState;
  export type Props = TooltipPortalProps;
}

/**
 * Positions the tooltip against the trigger.
 * Renders a `<div>` element.
 */
export const Positioner: typeof TooltipPositioner = TooltipPositioner;
export namespace Positioner {
  export type State = TooltipPositionerState;
  export type Props = TooltipPositionerProps;
}

/**
 * A container for the tooltip contents.
 * Renders a `<div>` element.
 */
export const Popup: typeof TooltipPopup = TooltipPopup;
export namespace Popup {
  export type State = TooltipPopupState;
  export type Props = TooltipPopupProps;
}

/**
 * Displays an element positioned against the tooltip anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof TooltipArrow = TooltipArrow;
export namespace Arrow {
  export type State = TooltipArrowState;
  export type Props = TooltipArrowProps;
}

/**
 * Provides a shared delay for multiple tooltips. The grouping logic ensures that
 * once a tooltip becomes visible, the adjacent tooltips will be shown instantly.
 */
export const Provider: typeof TooltipProvider = TooltipProvider;
export namespace Provider {
  export type State = TooltipProviderState;
  export type Props = TooltipProviderProps;
}

export {
  createTooltipHandle as createHandle,
  TooltipHandle as Handle,
} from './store/TooltipHandle';
