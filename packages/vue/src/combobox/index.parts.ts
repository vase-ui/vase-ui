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

export { useComboboxFilter as useFilter } from './root/utils/useFilter';
export { useFilteredItems } from './root/utils/useFilteredItems';
export { createComboboxItems as createItems } from './items/createItems';
