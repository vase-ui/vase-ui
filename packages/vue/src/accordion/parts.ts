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
  AccordionItemProps,
  AccordionItemState,
  AccordionPanelProps,
  AccordionPanelState,
  AccordionRootChangeEventDetails,
  AccordionRootChangeEventReason,
  AccordionRootProps,
  AccordionRootState,
  AccordionTriggerProps,
  AccordionTriggerState,
  AccordionValue,
} from './types';

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 */
export const Root: typeof AccordionRoot = AccordionRoot;
export namespace Root {
  export type Props<Value = any> = AccordionRootProps<Value>;
  export type State<Value = any> = AccordionRootState<Value>;
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}

/**
 * Groups an accordion header with the corresponding panel.
 * Renders a `<div>` element.
 */
export const Item: typeof AccordionItem = AccordionItem;
export namespace Item {
  export type Props = AccordionItemProps;
  export type State = AccordionItemState;
  export type ChangeEventReason = AccordionItemChangeEventReason;
  export type ChangeEventDetails = AccordionItemChangeEventDetails;
}

/**
 * A heading that labels the corresponding panel.
 * Renders an `<h3>` element.
 */
export const Header: typeof AccordionHeader = AccordionHeader;
export namespace Header {
  export type Props = AccordionHeaderProps;
  export type State = AccordionHeaderState;
}

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 */
export const Trigger: typeof AccordionTrigger = AccordionTrigger;
export namespace Trigger {
  export type Props = AccordionTriggerProps;
  export type State = AccordionTriggerState;
}

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 */
export const Panel: typeof AccordionPanel = AccordionPanel;
export namespace Panel {
  export type Props = AccordionPanelProps;
  export type State = AccordionPanelState;
}
