import ComboboxArrow from './arrow/ComboboxArrow.vue';
import type { ComboboxArrowProps, ComboboxArrowState } from './arrow/ComboboxArrow.vue';
import ComboboxBackdrop from './backdrop/ComboboxBackdrop.vue';
import type { ComboboxBackdropProps, ComboboxBackdropState } from './backdrop/ComboboxBackdrop.vue';
import ComboboxChipRemove from './chip-remove/ComboboxChipRemove.vue';
import type {
  ComboboxChipRemoveProps,
  ComboboxChipRemoveState,
} from './chip-remove/ComboboxChipRemove.vue';
import ComboboxChip from './chip/ComboboxChip.vue';
import type { ComboboxChipProps, ComboboxChipState } from './chip/ComboboxChip.vue';
import ComboboxChips from './chips/ComboboxChips.vue';
import type { ComboboxChipsProps, ComboboxChipsState } from './chips/ComboboxChips.vue';
import ComboboxClear from './clear/ComboboxClear.vue';
import type { ComboboxClearProps, ComboboxClearState } from './clear/ComboboxClear.vue';
import ComboboxCollection from './collection/ComboboxCollection.vue';
import type {
  ComboboxCollectionProps,
  ComboboxCollectionState,
} from './collection/ComboboxCollection.vue';
import ComboboxGroupLabel from './group-label/ComboboxGroupLabel.vue';
import type {
  ComboboxGroupLabelProps,
  ComboboxGroupLabelState,
} from './group-label/ComboboxGroupLabel.vue';
import ComboboxGroup from './group/ComboboxGroup.vue';
import type { ComboboxGroupProps, ComboboxGroupState } from './group/ComboboxGroup.vue';
import ComboboxIcon from './icon/ComboboxIcon.vue';
import type { ComboboxIconProps, ComboboxIconState } from './icon/ComboboxIcon.vue';
import ComboboxInput from './input/ComboboxInput.vue';
import type { ComboboxInputProps, ComboboxInputState } from './input/ComboboxInput.vue';
import ComboboxInputGroup from './input-group/ComboboxInputGroup.vue';
import type {
  ComboboxInputGroupProps,
  ComboboxInputGroupState,
} from './input-group/ComboboxInputGroup.vue';
import ComboboxItemIndicator from './item-indicator/ComboboxItemIndicator.vue';
import type {
  ComboboxItemIndicatorProps,
  ComboboxItemIndicatorState,
} from './item-indicator/ComboboxItemIndicator.vue';
import ComboboxItem from './item/ComboboxItem.vue';
import type { ComboboxItemProps, ComboboxItemState } from './item/ComboboxItem.vue';
import ComboboxLabel from './label/ComboboxLabel.vue';
import type { ComboboxLabelProps, ComboboxLabelState } from './label/ComboboxLabel.vue';
import ComboboxList from './list/ComboboxList.vue';
import type { ComboboxListProps, ComboboxListState } from './list/ComboboxList.vue';
import ComboboxPopup from './popup/ComboboxPopup.vue';
import type { ComboboxPopupProps, ComboboxPopupState } from './popup/ComboboxPopup.vue';
import ComboboxPortal from './portal/ComboboxPortal.vue';
import type { ComboboxPortalProps, ComboboxPortalState } from './portal/ComboboxPortal.vue';
import ComboboxPositioner from './positioner/ComboboxPositioner.vue';
import type {
  ComboboxPositionerProps,
  ComboboxPositionerState,
} from './positioner/ComboboxPositioner.vue';
import ComboboxRoot from './root/ComboboxRoot.vue';
import type {
  ComboboxRootActions,
  ComboboxRootChangeEventDetails,
  ComboboxRootChangeEventReason,
  ComboboxRootHighlightEventDetails,
  ComboboxRootHighlightEventReason,
  ComboboxRootOpenChangeEventDetails,
  ComboboxRootProps,
  ComboboxRootState,
} from './root/ComboboxRoot.vue';
import ComboboxRow from './row/ComboboxRow.vue';
import type { ComboboxRowProps, ComboboxRowState } from './row/ComboboxRow.vue';
import ComboboxSeparator from './separator/ComboboxSeparator.vue';
import type {
  ComboboxSeparatorProps,
  ComboboxSeparatorState,
} from './separator/ComboboxSeparator.vue';
import ComboboxTrigger from './trigger/ComboboxTrigger.vue';
import type { ComboboxTriggerProps, ComboboxTriggerState } from './trigger/ComboboxTrigger.vue';
import ComboboxValue from './value/ComboboxValue.vue';
import type { ComboboxValueProps, ComboboxValueState } from './value/ComboboxValue.vue';

/**
 * Groups all parts of the combobox.
 * Doesn't render its own HTML element.
 *
 * The part has more than one root node: the content of its default slot, then its hidden inputs.
 * `v-show` thus has no effect on it. Use `v-if`.
 */
export const Root: typeof ComboboxRoot = ComboboxRoot;
export namespace Root {
  export type Props<
    Value,
    Multiple extends boolean | undefined = false,
    Item = Value,
  > = ComboboxRootProps<Value, Multiple, Item>;
  export type State = ComboboxRootState;
  export type Actions = ComboboxRootActions;
  export type ChangeEventReason = ComboboxRootChangeEventReason;
  export type ChangeEventDetails = ComboboxRootChangeEventDetails;
  export type OpenChangeEventDetails = ComboboxRootOpenChangeEventDetails;
  export type HighlightEventReason = ComboboxRootHighlightEventReason;
  export type HighlightEventDetails = ComboboxRootHighlightEventDetails;
}

/**
 * An accessible label that is automatically associated with the combobox trigger.
 * Renders a `<div>` element.
 */
export const Label: typeof ComboboxLabel = ComboboxLabel;
export namespace Label {
  export type Props = ComboboxLabelProps;
  export type State = ComboboxLabelState;
}

/**
 * The current value of the combobox.
 * Doesn't render its own HTML element.
 *
 * The default slot formats the selected value with the slot props `{ value }`, in the place of the
 * function child of Base UI.
 */
export const Value: typeof ComboboxValue = ComboboxValue;
export namespace Value {
  export type Props = ComboboxValueProps;
  export type State = ComboboxValueState;
}

/**
 * A text input to search for items in the list.
 * Renders an `<input>` element.
 *
 * The part has more than one root node: the dismiss button of an open popup, then its element. A
 * rule of `<style scoped>` thus does not match its element, and `v-show` has no effect on it. Use
 * `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Input: typeof ComboboxInput = ComboboxInput;
export namespace Input {
  export type Props = ComboboxInputProps;
  export type State = ComboboxInputState;
}

/**
 * A wrapper for the input and its associated controls.
 * Renders a `<div>` element.
 */
export const InputGroup: typeof ComboboxInputGroup = ComboboxInputGroup;
export namespace InputGroup {
  export type Props = ComboboxInputGroupProps;
  export type State = ComboboxInputGroupState;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof ComboboxTrigger = ComboboxTrigger;
export namespace Trigger {
  export type Props = ComboboxTriggerProps;
  export type State = ComboboxTriggerState;
}

/**
 * A list container for the items.
 * Renders a `<div>` element.
 *
 * The default slot holds the content. The `item` slot renders each filtered item with the slot
 * props `{ item, index }`, in the place of the function child of Base UI.
 */
export const List: typeof ComboboxList = ComboboxList;
export namespace List {
  export type Props = ComboboxListProps;
  export type State = ComboboxListState;
}

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export const Portal: typeof ComboboxPortal = ComboboxPortal;
export namespace Portal {
  export type Props = ComboboxPortalProps;
  export type State = ComboboxPortalState;
}

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 */
export const Backdrop: typeof ComboboxBackdrop = ComboboxBackdrop;
export namespace Backdrop {
  export type Props = ComboboxBackdropProps;
  export type State = ComboboxBackdropState;
}

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * The part has more than one root node: the internal backdrop of a modal popup, then its element.
 * A rule of `<style scoped>` thus does not match its element, and `v-show` has no effect on it. Use
 * `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Positioner: typeof ComboboxPositioner = ComboboxPositioner;
export namespace Positioner {
  export type Props = ComboboxPositionerProps;
  export type State = ComboboxPositionerState;
}

/**
 * A container for the list.
 * Renders a `<div>` element.
 *
 * The part has more than one root node: its element, and the focus guards and the dismiss button
 * that it renders beside its element. A rule of `<style scoped>` thus does not match its element,
 * and `v-show` has no effect on it. Use `:deep()`, a CSS module, a `style` binding or `v-if`.
 */
export const Popup: typeof ComboboxPopup = ComboboxPopup;
export namespace Popup {
  export type Props = ComboboxPopupProps;
  export type State = ComboboxPopupState;
}

/**
 * Displays an element positioned against the anchor.
 * Renders a `<div>` element.
 */
export const Arrow: typeof ComboboxArrow = ComboboxArrow;
export namespace Arrow {
  export type Props = ComboboxArrowProps;
  export type State = ComboboxArrowState;
}

/**
 * An icon that indicates that the trigger button opens the popup.
 * Renders a `<span>` element.
 */
export const Icon: typeof ComboboxIcon = ComboboxIcon;
export namespace Icon {
  export type Props = ComboboxIconProps;
  export type State = ComboboxIconState;
}

/**
 * Groups related items with the corresponding label.
 * Renders a `<div>` element.
 */
export const Group: typeof ComboboxGroup = ComboboxGroup;
export namespace Group {
  export type Props = ComboboxGroupProps;
  export type State = ComboboxGroupState;
}

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 */
export const GroupLabel: typeof ComboboxGroupLabel = ComboboxGroupLabel;
export namespace GroupLabel {
  export type Props = ComboboxGroupLabelProps;
  export type State = ComboboxGroupLabelState;
}

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 */
export const Item: typeof ComboboxItem = ComboboxItem;
export namespace Item {
  export type Props = ComboboxItemProps;
  export type State = ComboboxItemState;
}

/**
 * Indicates whether the item is selected.
 * Renders a `<span>` element.
 */
export const ItemIndicator: typeof ComboboxItemIndicator = ComboboxItemIndicator;
export namespace ItemIndicator {
  export type Props = ComboboxItemIndicatorProps;
  export type State = ComboboxItemIndicatorState;
}

/**
 * A container for the chips in a multiselectable input.
 * Renders a `<div>` element.
 */
export const Chips: typeof ComboboxChips = ComboboxChips;
export namespace Chips {
  export type Props = ComboboxChipsProps;
  export type State = ComboboxChipsState;
}

/**
 * An individual chip that represents a value in a multiselectable input.
 * Renders a `<div>` element.
 */
export const Chip: typeof ComboboxChip = ComboboxChip;
export namespace Chip {
  export type Props = ComboboxChipProps;
  export type State = ComboboxChipState;
}

/**
 * A button to remove a chip.
 * Renders a `<button>` element.
 */
export const ChipRemove: typeof ComboboxChipRemove = ComboboxChipRemove;
export namespace ChipRemove {
  export type Props = ComboboxChipRemoveProps;
  export type State = ComboboxChipRemoveState;
}

/**
 * Displays a single row of items in a grid list.
 * Enable `grid` on the root component to turn the listbox into a grid.
 * Renders a `<div>` element.
 */
export const Row: typeof ComboboxRow = ComboboxRow;
export namespace Row {
  export type Props = ComboboxRowProps;
  export type State = ComboboxRowState;
}

/**
 * Renders filtered list items.
 * Doesn't render its own HTML element.
 *
 * The default slot renders each item with the slot props `{ item, index }`. To render a flat
 * list, give the `item` slot to the `List` part instead.
 */
export const Collection: typeof ComboboxCollection = ComboboxCollection;
export namespace Collection {
  export type Props = ComboboxCollectionProps;
  export type State = ComboboxCollectionState;
}

/**
 * Clears the value when clicked.
 * Renders a `<button>` element.
 */
export const Clear: typeof ComboboxClear = ComboboxClear;
export namespace Clear {
  export type Props = ComboboxClearProps;
  export type State = ComboboxClearState;
}

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 */
export const Separator: typeof ComboboxSeparator = ComboboxSeparator;
export namespace Separator {
  export type Props = ComboboxSeparatorProps;
  export type State = ComboboxSeparatorState;
}

export { useComboboxFilter as useFilter } from './root/utils/useFilter';
export { useFilteredItems } from './root/utils/useFilteredItems';
export { createComboboxItems as createItems } from './items/createItems';
