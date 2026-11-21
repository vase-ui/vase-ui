import AccordionHeader from './AccordionHeader.vue';
import AccordionItem from './AccordionItem.vue';
import AccordionPanel from './AccordionPanel.vue';
import AccordionRoot from './AccordionRoot.vue';
import AccordionTrigger from './AccordionTrigger.vue';
import type {
  AccordionHeaderProps,
  AccordionHeaderState,
  AccordionItemChangeEventDetails,
  AccordionItemChangeEventReason,
  AccordionItemEmits,
  AccordionItemProps,
  AccordionItemState,
  AccordionPanelProps,
  AccordionPanelState,
  AccordionRootChangeEventDetails,
  AccordionRootChangeEventReason,
  AccordionRootEmits,
  AccordionRootProps,
  AccordionRootState,
  AccordionTriggerProps,
  AccordionTriggerState,
  AccordionValue,
} from './types';

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The accordion is disabled.
 */
export const Root: typeof AccordionRoot = AccordionRoot;
export namespace Root {
  export type Props<Value = any> = AccordionRootProps<Value>;
  export type Emits<Value = any> = AccordionRootEmits<Value>;
  export type State<Value = any> = AccordionRootState<Value>;
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}

/**
 * Groups an accordion header with the corresponding panel.
 * Renders a `<div>` element.
 * @selector `[data-open]` The panel of the item is open.
 * @selector `[data-disabled]` The item or the accordion is disabled.
 */
export const Item: typeof AccordionItem = AccordionItem;
export namespace Item {
  export type Props = AccordionItemProps;
  export type Emits = AccordionItemEmits;
  export type State = AccordionItemState;
  export type ChangeEventReason = AccordionItemChangeEventReason;
  export type ChangeEventDetails = AccordionItemChangeEventDetails;
}

/**
 * A heading that labels the corresponding panel. Give it another heading level with `as`.
 * Renders an `<h3>` element.
 * @selector `[data-open]` The panel of the item is open.
 * @selector `[data-disabled]` The item or the accordion is disabled.
 */
export const Header: typeof AccordionHeader = AccordionHeader;
export namespace Header {
  export type Props = AccordionHeaderProps;
  export type State = AccordionHeaderState;
}

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The panel is open.
 * @selector `:disabled` The trigger is a native button, and the trigger, the item, the accordion or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger, the item or the accordion is disabled.
 */
export const Trigger: typeof AccordionTrigger = AccordionTrigger;
export namespace Trigger {
  export type Props = AccordionTriggerProps;
  export type State = AccordionTriggerState;
}

/**
 * A collapsible panel with the accordion item contents. With more than about six panels that can
 * be open at one time, give each panel another `role`, such as `group`.
 * Renders a `<div>` element with the role `region`.
 * @selector `[hidden]` The panel is closed, and `keepMounted` or `hiddenUntilFound` keeps it in the DOM.
 * @selector `[data-disabled]` The item or the accordion is disabled.
 * @cssVariable `--accordion-panel-height` The height of the content of the panel, in pixels. The panel writes it before each open and each close.
 * @cssVariable `--accordion-panel-width` The width of the content of the panel, in pixels. The panel writes it before each open and each close.
 */
export const Panel: typeof AccordionPanel = AccordionPanel;
export namespace Panel {
  export type Props = AccordionPanelProps;
  export type State = AccordionPanelState;
}
