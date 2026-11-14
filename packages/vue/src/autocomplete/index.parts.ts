import ComboboxArrow from '../combobox/arrow/ComboboxArrow.vue';
import type { ComboboxArrowProps, ComboboxArrowState } from '../combobox/arrow/ComboboxArrow.vue';
import ComboboxBackdrop from '../combobox/backdrop/ComboboxBackdrop.vue';
import type {
  ComboboxBackdropProps,
  ComboboxBackdropState,
} from '../combobox/backdrop/ComboboxBackdrop.vue';
import ComboboxClear from '../combobox/clear/ComboboxClear.vue';
import type { ComboboxClearProps, ComboboxClearState } from '../combobox/clear/ComboboxClear.vue';
import ComboboxCollection from '../combobox/collection/ComboboxCollection.vue';
import type {
  ComboboxCollectionProps,
  ComboboxCollectionState,
} from '../combobox/collection/ComboboxCollection.vue';
import ComboboxGroupLabel from '../combobox/group-label/ComboboxGroupLabel.vue';
import type {
  ComboboxGroupLabelProps,
  ComboboxGroupLabelState,
} from '../combobox/group-label/ComboboxGroupLabel.vue';
import ComboboxGroup from '../combobox/group/ComboboxGroup.vue';
import type { ComboboxGroupProps, ComboboxGroupState } from '../combobox/group/ComboboxGroup.vue';
import ComboboxIcon from '../combobox/icon/ComboboxIcon.vue';
import type { ComboboxIconProps, ComboboxIconState } from '../combobox/icon/ComboboxIcon.vue';
import ComboboxInput from '../combobox/input/ComboboxInput.vue';
import type { ComboboxInputProps, ComboboxInputState } from '../combobox/input/ComboboxInput.vue';
import ComboboxList from '../combobox/list/ComboboxList.vue';
import type { ComboboxListProps, ComboboxListState } from '../combobox/list/ComboboxList.vue';
import ComboboxPopup from '../combobox/popup/ComboboxPopup.vue';
import type { ComboboxPopupProps, ComboboxPopupState } from '../combobox/popup/ComboboxPopup.vue';
import ComboboxPortal from '../combobox/portal/ComboboxPortal.vue';
import type {
  ComboboxPortalProps,
  ComboboxPortalState,
} from '../combobox/portal/ComboboxPortal.vue';
import ComboboxPositioner from '../combobox/positioner/ComboboxPositioner.vue';
import type {
  ComboboxPositionerProps,
  ComboboxPositionerState,
} from '../combobox/positioner/ComboboxPositioner.vue';
import ComboboxRow from '../combobox/row/ComboboxRow.vue';
import type { ComboboxRowProps, ComboboxRowState } from '../combobox/row/ComboboxRow.vue';
import { AutocompleteInputGroup } from './input-group/AutocompleteInputGroup';
import type {
  AutocompleteInputGroupProps,
  AutocompleteInputGroupState,
} from './input-group/AutocompleteInputGroup';
import { AutocompleteItem } from './item/AutocompleteItem';
import type { AutocompleteItemProps, AutocompleteItemState } from './item/AutocompleteItem';
import AutocompleteRoot from './root/AutocompleteRoot.vue';
import type {
  AutocompleteRootActions,
  AutocompleteRootChangeEventDetails,
  AutocompleteRootChangeEventReason,
  AutocompleteRootHighlightEventDetails,
  AutocompleteRootHighlightEventReason,
  AutocompleteRootOpenChangeEventDetails,
  AutocompleteRootProps,
  AutocompleteRootState,
} from './root/AutocompleteRoot.vue';
import { AutocompleteSeparator } from './separator/AutocompleteSeparator';
import type {
  AutocompleteSeparatorProps,
  AutocompleteSeparatorState,
} from './separator/AutocompleteSeparator';
import { AutocompleteTrigger } from './trigger/AutocompleteTrigger';
import type {
  AutocompleteTriggerProps,
  AutocompleteTriggerState,
} from './trigger/AutocompleteTrigger';
import AutocompleteValue from './value/AutocompleteValue.vue';
import type { AutocompleteValueProps, AutocompleteValueState } from './value/AutocompleteValue.vue';

/**
 * Groups all parts of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * The part has more than one root node: the content of its default slot, then its hidden input.
 * `v-show` thus has no effect on it. Use `v-if`.
 */
export const Root: typeof AutocompleteRoot = AutocompleteRoot;
export namespace Root {
  export type Props<ItemValue = any> = AutocompleteRootProps<ItemValue>;
  export type State = AutocompleteRootState;
  export type Actions = AutocompleteRootActions;
  export type ChangeEventReason = AutocompleteRootChangeEventReason;
  export type ChangeEventDetails = AutocompleteRootChangeEventDetails;
  export type OpenChangeEventDetails = AutocompleteRootOpenChangeEventDetails;
  export type HighlightEventReason = AutocompleteRootHighlightEventReason;
  export type HighlightEventDetails = AutocompleteRootHighlightEventDetails;
}

/**
 * The current value of the autocomplete.
 * Doesn't render its own HTML element.
 */
export const Value: typeof AutocompleteValue = AutocompleteValue;
export namespace Value {
  export type Props = AutocompleteValueProps;
  export type State = AutocompleteValueState;
}

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 */
export const Trigger: typeof AutocompleteTrigger = AutocompleteTrigger;
export namespace Trigger {
  export type Props = AutocompleteTriggerProps;
  export type State = AutocompleteTriggerState;
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
export const InputGroup: typeof AutocompleteInputGroup = AutocompleteInputGroup;
export namespace InputGroup {
  export type Props = AutocompleteInputGroupProps;
  export type State = AutocompleteInputGroupState;
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
 * Clears the value when clicked.
 * Renders a `<button>` element.
 */
export const Clear: typeof ComboboxClear = ComboboxClear;
export namespace Clear {
  export type Props = ComboboxClearProps;
  export type State = ComboboxClearState;
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
export const Item: typeof AutocompleteItem = AutocompleteItem;
export namespace Item {
  export type Props = AutocompleteItemProps;
  export type State = AutocompleteItemState;
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
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 */
export const Separator: typeof AutocompleteSeparator = AutocompleteSeparator;
export namespace Separator {
  export type Props = AutocompleteSeparatorProps;
  export type State = AutocompleteSeparatorState;
}

export { useCoreFilter as useFilter } from '../combobox/root/utils/useFilter';
export { useFilteredItems } from '../combobox/root/utils/useFilteredItems';
