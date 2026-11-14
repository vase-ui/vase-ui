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

export {
  createTooltipHandle as createHandle,
  TooltipHandle as Handle,
} from './store/TooltipHandle';
