import { stringifyLocale } from './stringifyLocale';
import { stringifyAsLabel } from './resolveValueLabel';

const filterCache = new Map<string, Filter>();
// The count of texts whose comparison with the query a filter keeps.
const KEPT_COMPARISONS = 10_000;

export function getFilter(options: GetFilterParameters = {}): Filter {
  const { locale, ...restOptions } = options;
  const collatorOptions: Intl.CollatorOptions = {
    usage: 'search',
    sensitivity: 'base',
    ignorePunctuation: true,
    ...restOptions,
  };

  const cacheKey = `${stringifyLocale(locale)}|${JSON.stringify(collatorOptions)}`;
  const cachedFilter = filterCache.get(cacheKey);

  if (cachedFilter) {
    return cachedFilter;
  }

  const collator = new Intl.Collator(locale, collatorOptions);
  // The comparisons with the last query, by text. The labels of a list share most windows of text,
  // so a filter of a long list compares each different window one time.
  let comparedQuery = '';
  let comparisons = new Map<string, boolean>();
  const equals = (text: string, query: string) => {
    if (query !== comparedQuery) {
      comparedQuery = query;
      comparisons = new Map();
    }
    let equal = comparisons.get(text);
    if (equal === undefined) {
      equal = collator.compare(text, query) === 0;
      if (comparisons.size < KEPT_COMPARISONS) comparisons.set(text, equal);
    }
    return equal;
  };

  const filter: Filter = {
    contains<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);

      for (let i = 0; i <= itemString.length - query.length; i += 1) {
        if (equals(itemString.slice(i, i + query.length), query)) {
          return true;
        }
      }

      return false;
    },
    startsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);

      return equals(itemString.slice(0, query.length), query);
    },
    endsWith<Item>(item: Item, query: string, itemToString?: (item: Item) => string) {
      if (!query) {
        return true;
      }

      const itemString = stringifyAsLabel(item, itemToString);
      const queryLength = query.length;

      return (
        itemString.length >= queryLength &&
        equals(itemString.slice(itemString.length - queryLength), query)
      );
    },
  };

  filterCache.set(cacheKey, filter);
  return filter;
}

export interface GetFilterParameters extends Intl.CollatorOptions {
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
}

export interface Filter {
  /** Returns whether the item matches the query anywhere. */
  contains: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  /** Returns whether the item starts with the query. */
  startsWith: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
  /** Returns whether the item ends with the query. */
  endsWith: <Item>(item: Item, query: string, itemToString?: (item: Item) => string) => boolean;
}
