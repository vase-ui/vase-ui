import AutocompleteRoot from './AutocompleteRoot.vue';
import AutocompleteValue from './AutocompleteValue.vue';
import ComboboxInput from '../combobox/ComboboxInput.vue';
import ComboboxInputGroup from '../combobox/ComboboxInputGroup.vue';
import ComboboxTrigger from '../combobox/ComboboxTrigger.vue';
import ComboboxIcon from '../combobox/ComboboxIcon.vue';
import ComboboxClear from '../combobox/ComboboxClear.vue';
import ComboboxPortal from '../combobox/ComboboxPortal.vue';
import ComboboxBackdrop from '../combobox/ComboboxBackdrop.vue';
import ComboboxPositioner from '../combobox/ComboboxPositioner.vue';
import ComboboxPopup from '../combobox/ComboboxPopup.vue';
import ComboboxArrow from '../combobox/ComboboxArrow.vue';
import ComboboxList from '../combobox/ComboboxList.vue';
import ComboboxItem from '../combobox/ComboboxItem.vue';
import ComboboxRow from '../combobox/ComboboxRow.vue';
import ComboboxGroup from '../combobox/ComboboxGroup.vue';
import ComboboxGroupLabel from '../combobox/ComboboxGroupLabel.vue';
import ComboboxSeparator from '../combobox/ComboboxSeparator.vue';
import ComboboxStatus from '../combobox/ComboboxStatus.vue';
import ComboboxEmpty from '../combobox/ComboboxEmpty.vue';
import type {
  AutocompleteArrowProps,
  AutocompleteArrowState,
  AutocompleteBackdropProps,
  AutocompleteBackdropState,
  AutocompleteClearProps,
  AutocompleteClearState,
  AutocompleteEmptyProps,
  AutocompleteEmptyState,
  AutocompleteGroupLabelProps,
  AutocompleteGroupLabelState,
  AutocompleteGroupProps,
  AutocompleteGroupState,
  AutocompleteIconProps,
  AutocompleteIconState,
  AutocompleteInputGroupProps,
  AutocompleteInputGroupState,
  AutocompleteInputProps,
  AutocompleteInputState,
  AutocompleteItemProps,
  AutocompleteItemState,
  AutocompleteListProps,
  AutocompleteListState,
  AutocompletePopupProps,
  AutocompletePopupState,
  AutocompletePortalProps,
  AutocompletePortalState,
  AutocompletePositionerProps,
  AutocompletePositionerState,
  AutocompleteRootChangeEventDetails,
  AutocompleteRootChangeEventReason,
  AutocompleteRootHighlightEventDetails,
  AutocompleteRootHighlightEventReason,
  AutocompleteRootOpenChangeEventDetails,
  AutocompleteRootProps,
  AutocompleteRootState,
  AutocompleteRowProps,
  AutocompleteRowState,
  AutocompleteSeparatorProps,
  AutocompleteSeparatorState,
  AutocompleteStatusProps,
  AutocompleteStatusState,
  AutocompleteTriggerProps,
  AutocompleteTriggerState,
  AutocompleteValueProps,
  AutocompleteValueState,
} from './types';

export { useCoreFilter as useFilter } from '../combobox/filter';
export { useFilteredItems } from '../combobox/root';

/**
 * Groups the parts of the autocomplete.
 * Renders a `<div>` element.
 */
export const Root: typeof AutocompleteRoot = AutocompleteRoot;
export namespace Root {
  export type Props<Item = unknown> = AutocompleteRootProps<Item>;
  export type State = AutocompleteRootState;
  export type ChangeEventReason = AutocompleteRootChangeEventReason;
  export type ChangeEventDetails = AutocompleteRootChangeEventDetails;
  export type OpenChangeEventDetails = AutocompleteRootOpenChangeEventDetails;
  export type HighlightEventReason = AutocompleteRootHighlightEventReason;
  export type HighlightEventDetails = AutocompleteRootHighlightEventDetails;
}

/**
 * The text of the input. Renders no element.
 */
export const Value: typeof AutocompleteValue = AutocompleteValue;
export namespace Value {
  export type Props = AutocompleteValueProps;
  export type State = AutocompleteValueState;
}

/**
 * The text input.
 * Renders a `<input>` element.
 */
export const Input: typeof ComboboxInput = ComboboxInput;
export namespace Input {
  export type Props = AutocompleteInputProps;
  export type State = AutocompleteInputState;
}

/**
 * Groups the input and its buttons.
 * Renders a `<div>` element.
 */
export const InputGroup: typeof ComboboxInputGroup = ComboboxInputGroup;
export namespace InputGroup {
  export type Props = AutocompleteInputGroupProps;
  export type State = AutocompleteInputGroupState;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof ComboboxTrigger = ComboboxTrigger;
export namespace Trigger {
  export type Props = AutocompleteTriggerProps;
  export type State = AutocompleteTriggerState;
}

/**
 * An icon that shows that the popup opens.
 * Renders a `<span>` element.
 */
export const Icon: typeof ComboboxIcon = ComboboxIcon;
export namespace Icon {
  export type Props = AutocompleteIconProps;
  export type State = AutocompleteIconState;
}

/**
 * A button that clears the text.
 * Renders a `<button>` element.
 */
export const Clear: typeof ComboboxClear = ComboboxClear;
export namespace Clear {
  export type Props = AutocompleteClearProps;
  export type State = AutocompleteClearState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default. Renders no element.
 */
export const Portal: typeof ComboboxPortal = ComboboxPortal;
export namespace Portal {
  export type Props = AutocompletePortalProps;
  export type State = AutocompletePortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof ComboboxBackdrop = ComboboxBackdrop;
export namespace Backdrop {
  export type Props = AutocompleteBackdropProps;
  export type State = AutocompleteBackdropState;
}

/**
 * Places the popup at its anchor.
 * Renders a `<div>` element.
 */
export const Positioner: typeof ComboboxPositioner = ComboboxPositioner;
export namespace Positioner {
  export type Props = AutocompletePositionerProps;
  export type State = AutocompletePositionerState;
}

/**
 * The container of the list.
 * Renders a `<div>` element.
 */
export const Popup: typeof ComboboxPopup = ComboboxPopup;
export namespace Popup {
  export type Props = AutocompletePopupProps;
  export type State = AutocompletePopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof ComboboxArrow = ComboboxArrow;
export namespace Arrow {
  export type Props = AutocompleteArrowProps;
  export type State = AutocompleteArrowState;
}

/**
 * The list of the items.
 * Renders a `<div>` element.
 */
export const List: typeof ComboboxList = ComboboxList;
export namespace List {
  export type Props = AutocompleteListProps;
  export type State = AutocompleteListState;
}

/**
 * An item of the list.
 * Renders a `<div>` element.
 */
export const Item: typeof ComboboxItem = ComboboxItem;
export namespace Item {
  export type Props = AutocompleteItemProps;
  export type State = AutocompleteItemState;
}

/**
 * A row of items in a grid.
 * Renders a `<div>` element.
 */
export const Row: typeof ComboboxRow = ComboboxRow;
export namespace Row {
  export type Props = AutocompleteRowProps;
  export type State = AutocompleteRowState;
}

/**
 * Groups related items.
 * Renders a `<div>` element.
 */
export const Group: typeof ComboboxGroup = ComboboxGroup;
export namespace Group {
  export type Props = AutocompleteGroupProps;
  export type State = AutocompleteGroupState;
}

/**
 * Names a group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof ComboboxGroupLabel = ComboboxGroupLabel;
export namespace GroupLabel {
  export type Props = AutocompleteGroupLabelProps;
  export type State = AutocompleteGroupLabelState;
}

/**
 * Separates groups of items.
 * Renders a `<div>` element.
 */
export const Separator: typeof ComboboxSeparator = ComboboxSeparator;
export namespace Separator {
  export type Props = AutocompleteSeparatorProps;
  export type State = AutocompleteSeparatorState;
}

/**
 * Tells a screen reader the status of the list, such as a load.
 * Renders a `<div>` element.
 */
export const Status: typeof ComboboxStatus = ComboboxStatus;
export namespace Status {
  export type Props = AutocompleteStatusProps;
  export type State = AutocompleteStatusState;
}

/**
 * The text of an empty list.
 * Renders a `<div>` element.
 */
export const Empty: typeof ComboboxEmpty = ComboboxEmpty;
export namespace Empty {
  export type Props = AutocompleteEmptyProps;
  export type State = AutocompleteEmptyState;
}
