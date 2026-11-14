import ComboboxInputGroup from '../../combobox/input-group/ComboboxInputGroup.vue';
import type {
  ComboboxInputGroupProps,
  ComboboxInputGroupState,
} from '../../combobox/input-group/ComboboxInputGroup.vue';

export const AutocompleteInputGroup: typeof ComboboxInputGroup = ComboboxInputGroup;

export type AutocompleteInputGroupProps = ComboboxInputGroupProps;

export type AutocompleteInputGroupState = Omit<ComboboxInputGroupState, 'placeholder'>;
