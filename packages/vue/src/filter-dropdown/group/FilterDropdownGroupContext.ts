import { inject } from 'vue';
import type { InjectionKey } from 'vue';

export interface FilterDropdownGroupContext {
  registerItem: (id: symbol, retained: boolean) => () => void;
}

export const FilterDropdownGroupContext: InjectionKey<FilterDropdownGroupContext | null> = Symbol();

export function useFilterDropdownGroupContext(): FilterDropdownGroupContext | null {
  return inject(FilterDropdownGroupContext, null);
}
