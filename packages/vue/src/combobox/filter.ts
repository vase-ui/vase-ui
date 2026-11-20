import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { getFilter, type Filter, type GetFilterParameters } from '../internals/filter';
import { isGroupedItems, stringifyAsLabel, type Group } from '../internals/resolveValueLabel';
import { useLocale } from '../locale-provider/part';

export type { Filter };

export interface AutocompleteFilterOptions extends GetFilterParameters {}

export interface ComboboxFilterOptions extends GetFilterParameters {
  /**
   * The root selects more than one value. The rule of `value` then does not apply.
   * @default false
   */
  multiple?: boolean | undefined;
  /** The value of the root. `contains` keeps each item while the query is the label of this value. */
  value?: unknown;
}

/** A filter of the root: it keeps an item for the query. */
export type ItemFilter<Item = any> = (
  item: Item,
  query: string,
  itemToString?: (item: Item) => string,
) => boolean;

/**
 * The label function that the root gives to a filter. With `createItems()`, it reads a source item,
 * and `selected` reads a value.
 */
export type FilterItemToString = ((item: any) => string) & {
  selected?: ((value: any) => string) | undefined;
};

/**
 * The matches of `Intl.Collator` with `usage: 'search'`, `sensitivity: 'base'` and
 * `ignorePunctuation`. The options can be a ref or a getter. The locale is `locale`, else the nearest
 * `LocaleProvider`, else `'en-US'`.
 */
export function useCoreFilter(options: MaybeRefOrGetter<AutocompleteFilterOptions> = {}): Filter {
  const locale = useLocale(() => toValue(options).locale);
  const filter = computed(() => getFilter({ ...toValue(options), locale: locale.value }));
  return {
    contains: (item, query, itemToString) => filter.value.contains(item, query, itemToString),
    startsWith: (item, query, itemToString) => filter.value.startsWith(item, query, itemToString),
    endsWith: (item, query, itemToString) => filter.value.endsWith(item, query, itemToString),
  };
}

/**
 * The filter of `useCoreFilter`. With the option `value`, `contains` keeps each item while the
 * query is the label of that value, so the list shows each item after a pick. `multiple` turns that
 * rule off.
 */
export function useComboboxFilter(options: MaybeRefOrGetter<ComboboxFilterOptions> = {}): Filter {
  const core = useCoreFilter(() => {
    const { multiple: _multiple, value: _value, ...rest } = toValue(options);
    return rest;
  });
  return {
    ...core,
    contains(item, query, itemToString) {
      const { multiple, value } = toValue(options);
      if (!multiple && value != null && query) {
        const toLabel = (itemToString as FilterItemToString | undefined)?.selected ?? itemToString;
        const label = stringifyAsLabel(value, toLabel as ((value: unknown) => string) | undefined);
        if (label.length === query.length && core.contains(label, query)) return true;
      }
      return core.contains(item, query, itemToString);
    },
  };
}

/** The items that the filter keeps, in the order of the data, by group, up to `limit`. */
export function filterItems<Item>(
  items: readonly Item[] | readonly Group<Item>[],
  keep: (item: Item) => boolean,
  limit: number,
): Item[] | Group<Item>[] {
  let room = limit < 0 ? Infinity : limit;
  const take = (list: readonly Item[]) => {
    const kept: Item[] = [];
    for (const item of list) {
      if (kept.length >= room) break;
      if (keep(item)) kept.push(item);
    }
    room -= kept.length;
    return kept;
  };
  if (!isGroupedItems(items)) return take(items as readonly Item[]);
  const groups: Group<Item>[] = [];
  for (const group of items) {
    const kept = take(group.items);
    if (kept.length > 0) groups.push({ ...group, items: kept });
  }
  return groups;
}

/** The two results have the same items in the same order, also in each group. */
export function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (Object.is(item, other)) return true;
    if (!isGroupedItems([item]) || !isGroupedItems([other])) return false;
    const { items: own, ...rest } = item as Group;
    const { items: others, ...otherRest } = other as Group;
    const keys = Object.keys(rest);
    return (
      keys.length === Object.keys(otherRest).length &&
      keys.every((key) => Object.is(rest[key], otherRest[key])) &&
      sameItems(own, others)
    );
  });
}
