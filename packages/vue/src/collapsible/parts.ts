import CollapsiblePanel from './CollapsiblePanel.vue';
import CollapsibleRoot from './CollapsibleRoot.vue';
import CollapsibleTrigger from './CollapsibleTrigger.vue';
import type {
  CollapsiblePanelProps,
  CollapsiblePanelState,
  CollapsibleRootChangeEventDetails,
  CollapsibleRootChangeEventReason,
  CollapsibleRootProps,
  CollapsibleRootState,
  CollapsibleTriggerProps,
  CollapsibleTriggerState,
} from './types';

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
