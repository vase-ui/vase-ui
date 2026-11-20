import { error } from '../common/error';
import {
  compareItemEquality,
  defaultItemEquality,
  type ItemEqualityComparer,
} from '../internals/itemEquality';
import { flattenLeafItems, stringifyAsLabel, type Group } from '../internals/resolveValueLabel';

export type ComboboxPrimitiveValue = string | number | bigint | boolean;

/** A group of items in `items`: an object with an `items` list. */
export type ComboboxGroup<Item = unknown> = Group<Item>;

type RemoveIndexSignature<Type> = {
  [Key in keyof Type as string extends Key
    ? never
    : number extends Key
      ? never
      : symbol extends Key
        ? never
        : Key]: Type[Key];
};

/** Whether any constituent of `Item` declares an `items` field that may be a list. */
type HasGroupShape<Item> = Item extends object
  ? 'items' extends keyof RemoveIndexSignature<Item>
    ? [Extract<NonNullable<Item['items']>, readonly unknown[]>] extends [never]
      ? never[] extends NonNullable<Item['items']>
        ? true
        : never
      : true
    : never
  : never;

type IsAny<T> = 0 extends 1 & T ? true : false;

type GroupShapedItemsError =
  'Vase UI: items passed to createItems() cannot have an `items` array property because it marks a group. Rename the field or cast the data.';

type RejectGroupShapedItems<Item> =
  IsAny<Item> extends true
    ? unknown
    : true extends HasGroupShape<Item>
      ? GroupShapedItemsError
      : unknown;

// The group member comes first: when the candidates for `Item` have no common supertype, the
// compiler takes the first one, and the flat member would give the group as the item.
type ComboboxItemsData<Item> =
  | readonly { items: readonly Item[] }[]
  | (Extract<Item, { items: readonly unknown[] }> extends never ? readonly Item[] : never);

export interface CreateComboboxItemsOptions<
  Item,
  Value extends ComboboxPrimitiveValue = ComboboxPrimitiveValue,
> {
  /**
   * Gives the primitive value that identifies an item, which is the value of a pick. `null` and
   * `undefined` mean no value, and each item must give its own value.
   */
  getValue: (item: Item) => Value;
  /** Gives the text that the input shows for an item and that the filter reads. */
  getLabel: (item: Item) => string;
}

/**
 * A collection that `createItems()` makes, for the `items` prop of the root. It has no public
 * members.
 */
export declare class ComboboxItemCollection<in out Item, Value = Item> {
  private constructor();
  private readonly __itemCollectionBrand: (item: Item) => Value;
}

/** The members of a collection that the root reads. */
export interface ItemCollection<Item = any, Value = any> {
  /** The source items, flat or in groups. `undefined` while they load. */
  data: readonly Item[] | readonly Group<Item>[] | undefined;
  value(item: Item): Value;
  /** The value is the value of an item of the data. */
  hasValue(value: Value, isEqual: ItemEqualityComparer<Value>): boolean;
  itemLabel(item: Item): string;
  /** The label of the item with the value, else `fallback` of the value. */
  label(value: Value, isEqual: ItemEqualityComparer<Value>, fallback?: (value: Value) => string): string;
}

export function isItemCollection(value: unknown): value is ItemCollection {
  return !!value && !Array.isArray(value) && typeof (value as ItemCollection).label === 'function';
}

function findItem<Item, Value>(
  valueToItem: Map<Value, Item>,
  value: Value,
  isEqual: ItemEqualityComparer<Value>,
): Item | undefined {
  const exact = valueToItem.get(value);
  if (exact !== undefined || isEqual === defaultItemEquality) return exact;
  for (const [derived, item] of valueToItem) {
    if (compareItemEquality(derived, value, isEqual)) return item;
  }
  return undefined;
}

/**
 * Makes a collection for the `items` prop of the root. The value and the label of each item come
 * from the two functions at their first read. `data` is a flat list or a list of groups, with no
 * `null` or `undefined` entry. Make a dynamic collection in a `computed`, so that it changes only
 * with its data.
 */
export function createComboboxItems<Item, Value extends ComboboxPrimitiveValue>(
  data: (ComboboxItemsData<Item> & RejectGroupShapedItems<Item>) | undefined,
  options: CreateComboboxItemsOptions<Item, Value>,
): ComboboxItemCollection<Item, Value> {
  const { getValue, getLabel } = options;
  let valueToItem: Map<Value, Item> | undefined;

  function derived() {
    if (valueToItem) return valueToItem;
    valueToItem = new Map();
    for (const item of data ? flattenLeafItems<Item>(data as readonly Item[]) : []) {
      const value = getValue(item);
      if (!valueToItem.has(value)) valueToItem.set(value, item);
      else if (process.env.NODE_ENV !== 'production') {
        error(
          `Two items passed to createItems() derived the value ${String(value)}. The first item gives the label, and each item with the value shows as selected. Return a unique value from \`getValue\`.`,
        );
      }
    }
    return valueToItem;
  }

  const collection: ItemCollection<Item, Value> = {
    // Data that has not loaded stays no data, not an empty list that the filter empties.
    data: data as ItemCollection<Item, Value>['data'],
    value: (item) => (item == null ? (item as unknown as Value) : getValue(item)),
    hasValue: (value, isEqual) => findItem(derived(), value, isEqual) !== undefined,
    itemLabel: getLabel,
    label(value, isEqual, fallback) {
      const item = findItem(derived(), value, isEqual);
      return item === undefined ? stringifyAsLabel(value, fallback) : getLabel(item);
    },
  };
  return collection as unknown as ComboboxItemCollection<Item, Value>;
}
