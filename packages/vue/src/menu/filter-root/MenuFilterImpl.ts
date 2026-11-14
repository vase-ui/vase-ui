import { FilterDropdownHiddenItemText } from '../../filter-dropdown/item/FilterDropdownHiddenItemText';
import { useFilterDropdownItem } from '../../filter-dropdown/item/useFilterDropdownItem';
import type { MenuFilterImpl } from './MenuFilterContext';
import { useFilterGroup } from './MenuFilterGroup';
import { useFilterList } from './MenuFilterList';
import { useFilterPopup } from './MenuFilterPopup';

export const MENU_FILTER_IMPL: MenuFilterImpl = {
  usePopup: useFilterPopup,
  useList: useFilterList,
  useGroup: useFilterGroup,
  useItem: useFilterDropdownItem,
  HiddenItemText: FilterDropdownHiddenItemText,
};
