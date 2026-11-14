import ContextMenuRoot from './root/ContextMenuRoot.vue';
import type {
  ContextMenuRootActions,
  ContextMenuRootChangeEventDetails,
  ContextMenuRootChangeEventReason,
  ContextMenuRootProps,
  ContextMenuRootState,
} from './root/ContextMenuRoot.vue';
import ContextMenuTrigger from './trigger/ContextMenuTrigger.vue';
import type {
  ContextMenuTriggerProps,
  ContextMenuTriggerState,
} from './trigger/ContextMenuTrigger.vue';

/**
 * A component that creates a context menu activated by right clicking or long pressing.
 * Doesn't render its own HTML element.
 */
export const Root: typeof ContextMenuRoot = ContextMenuRoot;
export namespace Root {
  export type State = ContextMenuRootState;
  export type Props = ContextMenuRootProps;
  export type Actions = ContextMenuRootActions;
  export type ChangeEventReason = ContextMenuRootChangeEventReason;
  export type ChangeEventDetails = ContextMenuRootChangeEventDetails;
}

/**
 * An area that opens the menu on right click or long press.
 * Renders a `<div>` element.
 */
export const Trigger: typeof ContextMenuTrigger = ContextMenuTrigger;
export namespace Trigger {
  export type State = ContextMenuTriggerState;
  export type Props = ContextMenuTriggerProps;
}
