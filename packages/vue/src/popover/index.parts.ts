import PopoverRoot from './root/PopoverRoot.vue';
import type {
  PopoverRootActions,
  PopoverRootChangeEventDetails,
  PopoverRootChangeEventReason,
  PopoverRootProps,
  PopoverRootState,
} from './root/PopoverRoot.vue';
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

export {
  createPopoverHandle as createHandle,
  PopoverHandle as Handle,
} from './store/PopoverHandle';
