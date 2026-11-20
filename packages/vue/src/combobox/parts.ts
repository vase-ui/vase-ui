import ComboboxRoot from './ComboboxRoot.vue';
import ComboboxLabel from './ComboboxLabel.vue';
import ComboboxInput from './ComboboxInput.vue';
import ComboboxInputGroup from './ComboboxInputGroup.vue';
import ComboboxTrigger from './ComboboxTrigger.vue';
import ComboboxValue from './ComboboxValue.vue';
import ComboboxIcon from './ComboboxIcon.vue';
import ComboboxClear from './ComboboxClear.vue';
import ComboboxChips from './ComboboxChips.vue';
import ComboboxChip from './ComboboxChip.vue';
import ComboboxChipRemove from './ComboboxChipRemove.vue';
import ComboboxPortal from './ComboboxPortal.vue';
import ComboboxBackdrop from './ComboboxBackdrop.vue';
import ComboboxPositioner from './ComboboxPositioner.vue';
import ComboboxPopup from './ComboboxPopup.vue';
import ComboboxArrow from './ComboboxArrow.vue';
import ComboboxList from './ComboboxList.vue';
import ComboboxItem from './ComboboxItem.vue';
import ComboboxRow from './ComboboxRow.vue';
import ComboboxGroup from './ComboboxGroup.vue';
import ComboboxGroupLabel from './ComboboxGroupLabel.vue';
import ComboboxSeparator from './ComboboxSeparator.vue';
import ComboboxStatus from './ComboboxStatus.vue';
import ComboboxEmpty from './ComboboxEmpty.vue';
import type {
  ComboboxArrowProps,
  ComboboxArrowState,
  ComboboxBackdropProps,
  ComboboxBackdropState,
  ComboboxChipProps,
  ComboboxChipRemoveProps,
  ComboboxChipRemoveState,
  ComboboxChipState,
  ComboboxChipsProps,
  ComboboxChipsState,
  ComboboxClearProps,
  ComboboxClearState,
  ComboboxEmptyProps,
  ComboboxEmptyState,
  ComboboxGroupLabelProps,
  ComboboxGroupLabelState,
  ComboboxGroupProps,
  ComboboxGroupState,
  ComboboxIconProps,
  ComboboxIconState,
  ComboboxInputGroupProps,
  ComboboxInputGroupState,
  ComboboxInputProps,
  ComboboxInputState,
  ComboboxItemProps,
  ComboboxItemState,
  ComboboxLabelProps,
  ComboboxLabelState,
  ComboboxListProps,
  ComboboxListState,
  ComboboxPopupProps,
  ComboboxPopupState,
  ComboboxPortalProps,
  ComboboxPortalState,
  ComboboxPositionerProps,
  ComboboxPositionerState,
  ComboboxRootChangeEventDetails,
  ComboboxRootChangeEventReason,
  ComboboxRootHighlightEventDetails,
  ComboboxRootHighlightEventReason,
  ComboboxRootOpenChangeEventDetails,
  ComboboxRootProps,
  ComboboxRootState,
  ComboboxRowProps,
  ComboboxRowState,
  ComboboxSeparatorProps,
  ComboboxSeparatorState,
  ComboboxStatusProps,
  ComboboxStatusState,
  ComboboxTriggerProps,
  ComboboxTriggerState,
  ComboboxValueProps,
  ComboboxValueState,
} from './types';

export { createComboboxItems as createItems } from './items';
export { useComboboxFilter as useFilter } from './filter';
export { useFilteredItems } from './root';

/**
 * Groups the parts of the combobox, and holds the inputs of its form.
 * Renders a `<div>` element.
 */
export const Root: typeof ComboboxRoot = ComboboxRoot;
export namespace Root {
  export type Props<
    Value = unknown,
    Multiple extends boolean | undefined = false,
    Item = Value,
  > = ComboboxRootProps<Value, Multiple, Item>;
  export type State = ComboboxRootState;
  export type ChangeEventReason = ComboboxRootChangeEventReason;
  export type ChangeEventDetails = ComboboxRootChangeEventDetails;
  export type OpenChangeEventDetails = ComboboxRootOpenChangeEventDetails;
  export type HighlightEventReason = ComboboxRootHighlightEventReason;
  export type HighlightEventDetails = ComboboxRootHighlightEventDetails;
}

/**
 * Names the control of the combobox.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The combobox is disabled.
 * @selector `[data-valid]` In a `Field.Root`, the value is valid.
 * @selector `[data-invalid]` In a `Field.Root`, the value is invalid.
 * @selector `[data-touched]` In a `Field.Root`, the focus left the control one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the combobox has a value.
 */
export const Label: typeof ComboboxLabel = ComboboxLabel;
export namespace Label {
  export type Props = ComboboxLabelProps;
  export type State = ComboboxLabelState;
}

/**
 * The text input that filters the items.
 * Renders an `<input>` element.
 * @selector `[aria-expanded="true"]` The popup is open, the list is inline, or the input is in the popup.
 * @selector `[data-popup-side]` The side of the anchor that the open popup is on.
 * @selector `[data-list-empty]` The list has no item to show.
 * @selector `:disabled` The input or the combobox is disabled.
 * @selector `:read-only` The combobox is read-only.
 * @selector `[aria-required="true"]` The combobox is required, and the input is the control.
 * @selector `[aria-invalid="true"]` In a `Field.Root`, the input is the control, and the value is invalid.
 * @selector `[data-valid]` In a `Field.Root`, the input is the control, and the value is valid.
 * @selector `[data-touched]` In a `Field.Root`, the input is the control, and the focus left it one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the input is the control, and the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the input is the control, and the combobox has a value.
 */
export const Input: typeof ComboboxInput = ComboboxInput;
export namespace Input {
  export type Props = ComboboxInputProps;
  export type State = ComboboxInputState;
}

/**
 * Groups the input and its buttons.
 * Renders a `<div>` element.
 * @selector `[data-popup-open]` The popup is open.
 * @selector `[data-popup-side]` The side of the anchor that the open popup is on.
 * @selector `[data-list-empty]` The list has no item to show.
 * @selector `[data-readonly]` The combobox is read-only.
 * @selector `[data-placeholder]` The combobox has no value.
 * @selector `[data-disabled]` The combobox is disabled.
 * @selector `[data-valid]` In a `Field.Root`, the value is valid.
 * @selector `[data-invalid]` In a `Field.Root`, the value is invalid.
 * @selector `[data-touched]` In a `Field.Root`, the focus left the control one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the combobox has a value.
 */
export const InputGroup: typeof ComboboxInputGroup = ComboboxInputGroup;
export namespace InputGroup {
  export type Props = ComboboxInputGroupProps;
  export type State = ComboboxInputGroupState;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 * When the trigger is the control, a key on the closed trigger of a single combobox selects the
 * next item whose label starts with the typed text. The labels come from `items`, else from the
 * items of a popup that `keepMounted` keeps.
 * @selector `[aria-expanded="true"]` The popup is open.
 * @selector `[data-popup-side]` The side of the anchor that the open popup is on.
 * @selector `[data-list-empty]` The list has no item to show.
 * @selector `[data-readonly]` The combobox is read-only.
 * @selector `[data-required]` The combobox is required.
 * @selector `[data-placeholder]` The combobox has no value.
 * @selector `:disabled` The trigger is a native button, and the trigger, the combobox or a fieldset around the trigger is disabled.
 * @selector `[aria-disabled="true"]` The trigger is another element, and the trigger or the combobox is disabled.
 * @selector `[aria-invalid="true"]` In a `Field.Root`, the trigger is the control, and the value is invalid.
 * @selector `[data-invalid]` In a `Field.Root`, the trigger is beside the input, and the value is invalid.
 * @selector `[data-valid]` In a `Field.Root`, the value is valid.
 * @selector `[data-touched]` In a `Field.Root`, the focus left the control one time or more.
 * @selector `[data-dirty]` In a `Field.Root`, the value differs from the first value.
 * @selector `[data-filled]` In a `Field.Root`, the combobox has a value.
 */
export const Trigger: typeof ComboboxTrigger = ComboboxTrigger;
export namespace Trigger {
  export type Props = ComboboxTriggerProps;
  export type State = ComboboxTriggerState;
}

/**
 * The label of the value.
 * Renders no element.
 */
export const Value: typeof ComboboxValue = ComboboxValue;
export namespace Value {
  export type Props = ComboboxValueProps;
  export type State = ComboboxValueState;
}

/**
 * An icon that shows that the popup opens.
 * Renders a `<span>` element.
 */
export const Icon: typeof ComboboxIcon = ComboboxIcon;
export namespace Icon {
  export type Props = ComboboxIconProps;
  export type State = ComboboxIconState;
}

/**
 * A button that clears the value and the text.
 * Renders a `<button>` element.
 * Without `keepMounted`, it is in the DOM only while the combobox has a value.
 * @selector `[data-popup-open]` The popup is open.
 * @selector `[hidden]` There is nothing to clear, and `keepMounted` keeps the button in the DOM.
 * @selector `:disabled` The element is a native button, and the button, the combobox or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The element is not a native button, and the button or the combobox is disabled.
 */
export const Clear: typeof ComboboxClear = ComboboxClear;
export namespace Clear {
  export type Props = ComboboxClearProps;
  export type State = ComboboxClearState;
}

/**
 * The container of the chips of a multiple combobox.
 * Renders a `<div>` element.
 */
export const Chips: typeof ComboboxChips = ComboboxChips;
export namespace Chips {
  export type Props = ComboboxChipsProps;
  export type State = ComboboxChipsState;
}

/**
 * A selected value of a multiple combobox.
 * Renders a `<div>` element.
 * @selector `[data-disabled]` The combobox is disabled.
 */
export const Chip: typeof ComboboxChip = ComboboxChip;
export namespace Chip {
  export type Props = ComboboxChipProps;
  export type State = ComboboxChipState;
}

/**
 * A button that removes the value of its chip.
 * Renders a `<button>` element.
 * @selector `:disabled` The element is a native button, and the button, the combobox or a fieldset around it is disabled.
 * @selector `[aria-disabled="true"]` The element is not a native button, and the button or the combobox is disabled.
 */
export const ChipRemove: typeof ComboboxChipRemove = ComboboxChipRemove;
export namespace ChipRemove {
  export type Props = ComboboxChipRemoveProps;
  export type State = ComboboxChipRemoveState;
}

/**
 * Moves its content to another place of the DOM, `<body>` by default.
 * Renders no element.
 * With `keepMounted`, the closed popup keeps its list and the text of an input in it until the next
 * open.
 */
export const Portal: typeof ComboboxPortal = ComboboxPortal;
export namespace Portal {
  export type Props = ComboboxPortalProps;
  export type State = ComboboxPortalState;
}

/**
 * An overlay under the popup.
 * Renders a `<div>` element.
 * @selector `[hidden]` The combobox is closed, and `keepMounted` of the portal keeps the backdrop in the DOM.
 */
export const Backdrop: typeof ComboboxBackdrop = ComboboxBackdrop;
export namespace Backdrop {
  export type Props = ComboboxBackdropProps;
  export type State = ComboboxBackdropState;
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
 * @cssVariable `--transform-origin` The origin of a scale animation of the popup, at the anchor.
 */
export const Positioner: typeof ComboboxPositioner = ComboboxPositioner;
export namespace Positioner {
  export type Props = ComboboxPositionerProps;
  export type State = ComboboxPositionerState;
}

/**
 * The container of the list.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on: `top`, `bottom`, `left`, `right`, `inline-start` or `inline-end`.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-anchor-hidden]` The anchor is out of view.
 * @selector `[data-empty]` The list has no item to show.
 * @selector `[hidden]` The combobox is closed, and `keepMounted` of the portal keeps the popup in the DOM.
 */
export const Popup: typeof ComboboxPopup = ComboboxPopup;
export namespace Popup {
  export type Props = ComboboxPopupProps;
  export type State = ComboboxPopupState;
}

/**
 * An element that points to the anchor.
 * Renders a `<div>` element.
 * @selector `[data-side]` The side of the anchor that the popup is on.
 * @selector `[data-align]` The alignment of the popup on its side: `start`, `center` or `end`.
 * @selector `[data-uncentered]` The arrow cannot point to the center of the anchor.
 */
export const Arrow: typeof ComboboxArrow = ComboboxArrow;
export namespace Arrow {
  export type Props = ComboboxArrowProps;
  export type State = ComboboxArrowState;
}

/**
 * The list of the items.
 * Renders a `<div>` element.
 * @selector `[data-empty]` The list has no item to show.
 */
export const List: typeof ComboboxList = ComboboxList;
export namespace List {
  export type Props = ComboboxListProps;
  export type State = ComboboxListState;
}

/**
 * An item of the list.
 * Renders a `<div>` element.
 * @selector `[data-highlighted]` The item has the highlight.
 * @selector `[aria-selected="true"]` The item is selected.
 * @selector `[aria-disabled="true"]` The item or the combobox is disabled.
 */
export const Item: typeof ComboboxItem = ComboboxItem;
export namespace Item {
  export type Props = ComboboxItemProps;
  export type State = ComboboxItemState;
}

/**
 * A row of items in a grid.
 * Renders a `<div>` element.
 */
export const Row: typeof ComboboxRow = ComboboxRow;
export namespace Row {
  export type Props = ComboboxRowProps;
  export type State = ComboboxRowState;
}

/**
 * Groups related items.
 * Renders a `<div>` element.
 */
export const Group: typeof ComboboxGroup = ComboboxGroup;
export namespace Group {
  export type Props = ComboboxGroupProps;
  export type State = ComboboxGroupState;
}

/**
 * Names a group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof ComboboxGroupLabel = ComboboxGroupLabel;
export namespace GroupLabel {
  export type Props = ComboboxGroupLabelProps;
  export type State = ComboboxGroupLabelState;
}

/**
 * Separates groups of items.
 * Renders a `<div>` element.
 * @selector `[data-orientation]` The orientation of the separator: `horizontal` or `vertical`.
 */
export const Separator: typeof ComboboxSeparator = ComboboxSeparator;
export namespace Separator {
  export type Props = ComboboxSeparatorProps;
  export type State = ComboboxSeparatorState;
}

/**
 * Tells a screen reader the status of the list, such as a load.
 * Renders a `<div>` element.
 */
export const Status: typeof ComboboxStatus = ComboboxStatus;
export namespace Status {
  export type Props = ComboboxStatusProps;
  export type State = ComboboxStatusState;
}

/**
 * The text of an empty list.
 * Renders a `<div>` element.
 */
export const Empty: typeof ComboboxEmpty = ComboboxEmpty;
export namespace Empty {
  export type Props = ComboboxEmptyProps;
  export type State = ComboboxEmptyState;
}
