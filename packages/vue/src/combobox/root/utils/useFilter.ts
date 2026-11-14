import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { getFilter } from '../../../internals/filter';
import type { Filter, GetFilterParameters as UseFilterOptions } from '../../../internals/filter';
import { useFormatLocale } from '../../../utils/useFormatLocale';
import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from './index';

export type { Filter, UseFilterOptions };

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export const useCoreFilter = getFilter;

export interface UseComboboxFilterOptions extends UseFilterOptions {
  /**
   * Whether the combobox is in multiple selection mode.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * The current value of the combobox, used to keep every item visible while the query still
   * matches the selection.
   */
  value?: any;
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 * Call it in `setup`. Pass the options as a ref or a getter, so that the filter follows a change of
 * an option. With no `locale`, the filter uses `en-US` until the component is mounted, and then the
 * runtime locale.
 */
export function useComboboxFilter(
  options: MaybeRefOrGetter<UseComboboxFilterOptions> = {},
): Filter {
  const locale = useFormatLocale(() => toValue(options).locale);

  const state = computed(() => {
    const { multiple = false, value, ...collatorOptions } = toValue(options);
    return {
      multiple,
      value,
      coreFilter: getFilter({ ...collatorOptions, locale: locale.value }),
    };
  });

  return {
    contains(item, query, itemToString) {
      const { multiple, value, coreFilter } = state.value;
      if (multiple) {
        return createCollatorItemFilter(coreFilter, itemToString)(item, query);
      }
      return createSingleSelectionCollatorFilter(coreFilter, itemToString, value)(item, query);
    },
    startsWith(item, query, itemToString) {
      return state.value.coreFilter.startsWith(item, query, itemToString);
    },
    endsWith(item, query, itemToString) {
      return state.value.coreFilter.endsWith(item, query, itemToString);
    },
  };
}
