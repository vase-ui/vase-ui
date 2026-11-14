import type { ComputedRef } from 'vue';
import { useComboboxDerivedItemsContext } from '../ComboboxRootContext';

/**
 * Returns a ref of the items that the filter of the root keeps.
 * Do not change the list. It is internal state, and it can be a frozen array that other code
 * shares.
 */
export function useFilteredItems<T>(): ComputedRef<T[]> {
  return useComboboxDerivedItemsContext().filteredItems as ComputedRef<T[]>;
}
