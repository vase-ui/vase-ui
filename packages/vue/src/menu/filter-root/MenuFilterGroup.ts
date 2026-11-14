import { computed } from 'vue';
import { useFilterDropdownGroup } from '../../filter-dropdown/group/useFilterDropdownGroup';
import type { MenuFilterGroup } from './MenuFilterContext';

/**
 * Hides a `Menu.Group` or a `Menu.RadioGroup` in a filterable menu, label included, once the query
 * filters out all of its items. The group part calls it in `setup`.
 */
export function useFilterGroup(): MenuFilterGroup {
  const { hidden } = useFilterDropdownGroup();

  // The group stays hidden also when the consumer gives `hidden` the value `false`.
  return { hiddenProps: computed(() => (hidden.value ? { hidden: true } : undefined)) };
}
