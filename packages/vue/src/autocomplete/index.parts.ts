import ComboboxClear from '../combobox/clear/ComboboxClear.vue';
import type { ComboboxClearProps, ComboboxClearState } from '../combobox/clear/ComboboxClear.vue';
import ComboboxIcon from '../combobox/icon/ComboboxIcon.vue';
import type { ComboboxIconProps, ComboboxIconState } from '../combobox/icon/ComboboxIcon.vue';
import ComboboxInput from '../combobox/input/ComboboxInput.vue';
import type { ComboboxInputProps, ComboboxInputState } from '../combobox/input/ComboboxInput.vue';
import { AutocompleteInputGroup } from './input-group/AutocompleteInputGroup';
import type {
  AutocompleteInputGroupProps,
  AutocompleteInputGroupState,
} from './input-group/AutocompleteInputGroup';
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

export { useCoreFilter as useFilter } from '../combobox/root/utils/useFilter';
export { useFilteredItems } from '../combobox/root/utils/useFilteredItems';
