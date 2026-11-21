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
  AutocompleteRootEmits,
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
  export type Emits<Item = unknown> = AutocompleteRootEmits<Item>;
  export type State = AutocompleteRootState;
  export type ChangeEventReason = AutocompleteRootChangeEventReason;
  export type ChangeEventDetails = AutocompleteRootChangeEventDetails;
  export type OpenChangeEventDetails = AutocompleteRootOpenChangeEventDetails;
  export type HighlightEventReason = AutocompleteRootHighlightEventReason;
  export type HighlightEventDetails = AutocompleteRootHighlightEventDetails;
}

/**
 * The text of the input.
 * Renders no element.
 */
export const Value: typeof AutocompleteValue = AutocompleteValue;
export namespace Value {
  export type Props = AutocompleteValueProps;
  export type State = AutocompleteValueState;
}

/**
 * The text input.
 * Renders an `<input>` element.
 * Outside the popup, the input is the form control: it has the `name`, `required` and the text of
 * the root. In the popup, the root gives the form a hidden input after its mount.
 * @selector `[aria-expanded="true"]` The popup is open, the list is inline, or the input is in the popup.
 * @selector `[data-popup-side]` The side of the anchor that the open popup is on.
 * @selector `[data-list-empty]` The list has no item to show.
 * @selector `:disabled` The input or the autocomplete is disabled.
 * @selector `:read-only` The autocomplete is read-only.
 * @selector `:required` The autocomplete is required, and the input is the control.
 * @selector `[aria-invalid="true"]` In a `Field.Root`, the input is the control, and the value is invalid.
 * @selector `[data-valid]` In a `Field.Root`, the input is the control, and the value is valid.
 * @selector `[data-touched]` In a `Field.Root`, the input is the control, and the focus left it one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the input is the control, and the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the input is the control and has text.
 */
export const Input: typeof ComboboxInput = ComboboxInput;
export namespace Input {
  export type Props = AutocompleteInputProps;
  export type State = AutocompleteInputState;
}

/**
 * Groups the input and its buttons.
 * Renders a `<div>` element.
 * @selector `[data-popup-open]` The popup is open.
 * @selector `[data-popup-side]` The side of the anchor that the open popup is on.
 * @selector `[data-list-empty]` The list has no item to show.
 * @selector `[data-readonly]` The autocomplete is read-only.
 * @selector `[data-disabled]` The autocomplete is disabled.
 * @selector `[data-valid]` In a `Field.Root`, the value is valid.
 * @selector `[data-invalid]` In a `Field.Root`, the value is invalid.
 * @selector `[data-touched]` In a `Field.Root`, the focus left the control one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the input has text.
 */
export const InputGroup: typeof ComboboxInputGroup = ComboboxInputGroup;
export namespace InputGroup {
  export type Props = AutocompleteInputGroupProps;
  export type State = AutocompleteInputGroupState;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 * @selector `[aria-expanded="true"]` The popup is open.
 * @selector `[data-popup-side]` The side of the anchor that the open popup is on.
 * @selector `[data-list-empty]` The list has no item to show.
 * @selector `[data-readonly]` The autocomplete is read-only.
 * @selector `[data-required]` The autocomplete is required.
 * @selector `:disabled` The trigger is a native button, and the trigger, the autocomplete or a fieldset around the trigger is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger or the autocomplete is disabled.
 * @selector `[aria-invalid="true"]` In a `Field.Root`, the trigger is the control, and the value is invalid.
 * @selector `[data-invalid]` In a `Field.Root`, the trigger is beside the input, and the value is invalid.
 * @selector `[data-valid]` In a `Field.Root`, the value is valid.
 * @selector `[data-touched]` In a `Field.Root`, the focus left the control one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the input has text.
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
 * Without `keepMounted`, it is in the DOM only while the input has text.
 * @selector `[data-popup-open]` The popup is open.
 * @selector `[hidden]` There is nothing to clear, and `keepMounted` keeps the button in the DOM.
 * @selector `:disabled` The element is a native button, and the button, the autocomplete or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The element is not a native button, and the button or the autocomplete is disabled.
 */
export const Clear: typeof ComboboxClear = ComboboxClear;
export namespace Clear {
  export type Props = AutocompleteClearProps;
  export type State = AutocompleteClearState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 * With `keepMounted`, the closed popup keeps its list and the text of an input in it until the next
 * open.
 */
export const Portal: typeof ComboboxPortal = ComboboxPortal;
export namespace Portal {
  export type Props = AutocompletePortalProps;
  export type State = AutocompletePortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 * @selector `[hidden]` The autocomplete is closed, and `keepMounted` of the portal keeps the backdrop in the DOM.
 */
export const Backdrop: typeof ComboboxBackdrop = ComboboxBackdrop;
export namespace Backdrop {
  export type Props = AutocompleteBackdropProps;
  export type State = AutocompleteBackdropState;
}

/**
 * Places the popup at its anchor.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @selector `[data-empty]` The list has no item to show.
 * @cssVariable `--anchor-width` The width of the anchor, in pixels.
 * @cssVariable `--anchor-height` The height of the anchor, in pixels.
 * @cssVariable `--available-width` The width that the popup can fill before it overflows the boundary, in pixels.
 * @cssVariable `--available-height` The height that the popup can fill before it overflows the boundary, in pixels.
 * @cssVariable `--transform-origin` The point that the popup grows from, for the `transform-origin` of the popup. It is at the arrow, on the edge of the anchor. With no arrow, it is at the aligned edge of the popup or at the center of the anchor.
 */
export const Positioner: typeof ComboboxPositioner = ComboboxPositioner;
export namespace Positioner {
  export type Props = AutocompletePositionerProps;
  export type State = AutocompletePositionerState;
}

/**
 * The container of the list.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @selector `[data-empty]` The list has no item to show.
 * @selector `[hidden]` The autocomplete is closed, and `keepMounted` of the portal keeps the popup in the DOM.
 */
export const Popup: typeof ComboboxPopup = ComboboxPopup;
export namespace Popup {
  export type Props = AutocompletePopupProps;
  export type State = AutocompletePopupState;
}

/**
 * An element that points to the center of the anchor.
 * Renders a `<div>` element.
 * Its place is in the padding box of its nearest positioned ancestor: the popup when the popup has a `position`, else the positioner.
 * @selector `[data-side]` The side of the anchor that the popup is on.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-uncentered]` The arrow cannot point to the center of the anchor.
 */
export const Arrow: typeof ComboboxArrow = ComboboxArrow;
export namespace Arrow {
  export type Props = AutocompleteArrowProps;
  export type State = AutocompleteArrowState;
}

/**
 * The list of the items.
 * Renders a `<div>` element.
 * @selector `[data-empty]` The list has no item to show.
 */
export const List: typeof ComboboxList = ComboboxList;
export namespace List {
  export type Props = AutocompleteListProps;
  export type State = AutocompleteListState;
}

/**
 * An item of the list.
 * Renders a `<div>` element.
 * @selector `[data-highlighted]` The item has the highlight.
 * @selector `[aria-disabled="true"]` The item or the autocomplete is disabled.
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
 * @selector `[data-orientation]` The orientation of the separator: `horizontal` or `vertical`.
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
