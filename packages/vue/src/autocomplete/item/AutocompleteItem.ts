import ComboboxItem from '../../combobox/item/ComboboxItem.vue';
import type { ComboboxItemProps, ComboboxItemState } from '../../combobox/item/ComboboxItem.vue';

export const AutocompleteItem: typeof ComboboxItem = ComboboxItem;

export type AutocompleteItemProps = ComboboxItemProps;

export type AutocompleteItemState = Omit<ComboboxItemState, 'selected'>;
