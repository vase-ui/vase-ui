import AccordionHeader from './header/AccordionHeader.vue';
import type { AccordionHeaderProps, AccordionHeaderState } from './header/AccordionHeader.vue';
import AccordionItem from './item/AccordionItem.vue';
import type {
  AccordionItemChangeEventDetails,
  AccordionItemChangeEventReason,
  AccordionItemProps,
  AccordionItemState,
} from './item/AccordionItem.vue';
import AccordionPanel from './panel/AccordionPanel.vue';
import type { AccordionPanelProps, AccordionPanelState } from './panel/AccordionPanel.vue';
import AccordionRoot from './root/AccordionRoot.vue';
import type {
  AccordionRootChangeEventDetails,
  AccordionRootChangeEventReason,
  AccordionRootProps,
  AccordionRootState,
  AccordionValue,
} from './root/AccordionRoot.vue';
import AccordionTrigger from './trigger/AccordionTrigger.vue';
import type { AccordionTriggerProps, AccordionTriggerState } from './trigger/AccordionTrigger.vue';

/**
 * Groups all parts of the accordion.
 * Renders a `<div>` element.
 */
export const Root: typeof AccordionRoot = AccordionRoot;
export namespace Root {
  export type Value<TValue = any> = AccordionValue<TValue>;
  export type State<TValue = any> = AccordionRootState<TValue>;
  export type Props<TValue = any> = AccordionRootProps<TValue>;
  export type ChangeEventReason = AccordionRootChangeEventReason;
  export type ChangeEventDetails = AccordionRootChangeEventDetails;
}

/**
 * Groups an accordion header with the corresponding panel.
 * Renders a `<div>` element.
 */
export const Item: typeof AccordionItem = AccordionItem;
export namespace Item {
  export type State = AccordionItemState;
  export type Props = AccordionItemProps;
  export type ChangeEventReason = AccordionItemChangeEventReason;
  export type ChangeEventDetails = AccordionItemChangeEventDetails;
}

/**
 * A heading that labels the corresponding panel.
 * Renders an `<h3>` element.
 */
export const Header: typeof AccordionHeader = AccordionHeader;
export namespace Header {
  export type State = AccordionHeaderState;
  export type Props = AccordionHeaderProps;
}

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 */
export const Trigger: typeof AccordionTrigger = AccordionTrigger;
export namespace Trigger {
  export type State = AccordionTriggerState;
  export type Props = AccordionTriggerProps;
}

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 */
export const Panel: typeof AccordionPanel = AccordionPanel;
export namespace Panel {
  export type State = AccordionPanelState;
  export type Props = AccordionPanelProps;
}
