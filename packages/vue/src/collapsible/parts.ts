import CollapsiblePanel from './CollapsiblePanel.vue';
import CollapsibleRoot from './CollapsibleRoot.vue';
import CollapsibleTrigger from './CollapsibleTrigger.vue';
import type {
  CollapsiblePanelProps,
  CollapsiblePanelState,
  CollapsibleRootChangeEventDetails,
  CollapsibleRootChangeEventReason,
  CollapsibleRootEmits,
  CollapsibleRootProps,
  CollapsibleRootState,
  CollapsibleTriggerProps,
  CollapsibleTriggerState,
} from './types';

/**
 * Groups all parts of the collapsible.
 * Renders a `<div>` element.
 * @selector `[data-open]` The panel is open.
 * @selector `[data-disabled]` The collapsible is disabled.
 */
export const Root: typeof CollapsibleRoot = CollapsibleRoot;
export namespace Root {
  export type Props = CollapsibleRootProps;
  export type Emits = CollapsibleRootEmits;
  export type State = CollapsibleRootState;
  export type ChangeEventReason = CollapsibleRootChangeEventReason;
  export type ChangeEventDetails = CollapsibleRootChangeEventDetails;
}

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The panel is open.
 * @selector `:disabled` The trigger is a native button, and the trigger, the collapsible or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger or the collapsible is disabled.
 */
export const Trigger: typeof CollapsibleTrigger = CollapsibleTrigger;
export namespace Trigger {
  export type Props = CollapsibleTriggerProps;
  export type State = CollapsibleTriggerState;
}

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 * @selector `[hidden]` The panel is closed, and `keepMounted` or `hiddenUntilFound` keeps it in the DOM.
 * @selector `[data-disabled]` The collapsible is disabled.
 * @cssVariable `--collapsible-panel-height` The height of the content of the panel, in pixels. The panel writes it before each open and each close.
 * @cssVariable `--collapsible-panel-width` The width of the content of the panel, in pixels. The panel writes it before each open and each close.
 */
export const Panel: typeof CollapsiblePanel = CollapsiblePanel;
export namespace Panel {
  export type Props = CollapsiblePanelProps;
  export type State = CollapsiblePanelState;
}
