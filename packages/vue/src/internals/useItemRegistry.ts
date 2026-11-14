import { computed, shallowRef } from 'vue';
import type { ComputedRef } from 'vue';

type RegisterItem<Key, Item> = (key: Key, item: Item) => () => void;

/**
 * Collects item registrations into one immutable snapshot per Vue flush.
 * Also returns the live registry for reads that must include the registrations of the current
 * flush before its snapshot is published.
 *
 * Call it in `setup`.
 */
export function useItemRegistry<Key, Item>(): ItemRegistry<Key, Item> {
  const itemRegistry = new Map<Key, Item>();
  const registryVersion = shallowRef(0);
  // A count of its own keeps a registration from reading the version, so a registration in a
  // render or in a `computed` does not make it depend on the version.
  let version = 0;

  function registerItem(key: Key, item: Item) {
    itemRegistry.set(key, item);
    version += 1;
    registryVersion.value = version;

    return () => {
      itemRegistry.delete(key);
      version += 1;
      registryVersion.value = version;
    };
  }

  // A `computed` makes its copy only when a reader runs, and a watcher or a render runs one time in
  // a flush. Each registration of the flush is then in one copy.
  const items = computed<ReadonlyMap<Key, Item>>(() => {
    void registryVersion.value;
    return new Map(itemRegistry);
  });

  return { items, registerItem, liveItems: itemRegistry };
}

export interface ItemRegistry<Key, Item> {
  /** The snapshot published after the latest flush's registrations. */
  items: ComputedRef<ReadonlyMap<Key, Item>>;
  registerItem: RegisterItem<Key, Item>;
  /** The registry itself, including registrations whose snapshot hasn't been published yet. */
  liveItems: ReadonlyMap<Key, Item>;
}
