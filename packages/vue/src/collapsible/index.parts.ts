import CollapsiblePanel from './panel/CollapsiblePanel.vue';
import type { CollapsiblePanelProps, CollapsiblePanelState } from './panel/CollapsiblePanel.vue';
import CollapsibleRoot from './root/CollapsibleRoot.vue';
import type {
  CollapsibleRootChangeEventDetails,
  CollapsibleRootChangeEventReason,
  CollapsibleRootProps,
  CollapsibleRootState,
} from './root/CollapsibleRoot.vue';
import CollapsibleTrigger from './trigger/CollapsibleTrigger.vue';
import type {
  CollapsibleTriggerProps,
  CollapsibleTriggerState,
} from './trigger/CollapsibleTrigger.vue';

/**
 * Groups all parts of the collapsible.
 * Renders a `<div>` element.
 */
export const Root: typeof CollapsibleRoot = CollapsibleRoot;
export namespace Root {
  export type Props = CollapsibleRootProps;
  export type State = CollapsibleRootState;
  export type ChangeEventReason = CollapsibleRootChangeEventReason;
  export type ChangeEventDetails = CollapsibleRootChangeEventDetails;
}

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 */
export const Trigger: typeof CollapsibleTrigger = CollapsibleTrigger;
export namespace Trigger {
  export type Props = CollapsibleTriggerProps;
  export type State = CollapsibleTriggerState;
}

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 */
export const Panel: typeof CollapsiblePanel = CollapsiblePanel;
export namespace Panel {
  export type Props = CollapsiblePanelProps;
  export type State = CollapsiblePanelState;
}
