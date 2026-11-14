import ComboboxTrigger from '../../combobox/trigger/ComboboxTrigger.vue';
import type {
  ComboboxTriggerProps,
  ComboboxTriggerState,
} from '../../combobox/trigger/ComboboxTrigger.vue';

export const AutocompleteTrigger: typeof ComboboxTrigger = ComboboxTrigger;

export type AutocompleteTriggerProps = ComboboxTriggerProps;

export type AutocompleteTriggerState = Omit<ComboboxTriggerState, 'placeholder'>;
