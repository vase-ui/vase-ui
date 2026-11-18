import { computed, shallowRef, triggerRef } from 'vue';
import type { ComputedRef } from 'vue';

type RegisterItem<Key, Item> = (key: Key, item: Item) => () => void;

/**
 * Collects items in a live map. A computed reader gets a fresh snapshot after an item registers or leaves.
 *
 * Call it in `setup`.
 */
export function useItemRegistry<Key, Item>(): ItemRegistry<Key, Item> {
  // A caller can register an item inside an effect without a subscription to other items.
  const liveItems = new Map<Key, Item>();
  const registry = shallowRef(liveItems);
  const items = computed<ReadonlyMap<Key, Item>>(() => new Map(registry.value));

  function registerItem(key: Key, item: Item) {
    liveItems.set(key, item);
    triggerRef(registry);

    return () => {
      liveItems.delete(key);
      triggerRef(registry);
    };
  }

  return { items, registerItem, liveItems };
}

export interface ItemRegistry<Key, Item> {
  /** The snapshot keeps its entries after a change to the live map. */
  items: ComputedRef<ReadonlyMap<Key, Item>>;
  registerItem: RegisterItem<Key, Item>;
  /** Reads of the live map do not subscribe to later changes. */
  liveItems: ReadonlyMap<Key, Item>;
}
