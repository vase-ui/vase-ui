import { toValue, watchSyncEffect } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useKeepAliveState } from './useKeepAliveState';

/** Registers the actual element of a part for the lifetime of its ref outside a hold. */
export function useElementRegistration<T>(
  registry: WeakMap<Element, () => T>,
  element: MaybeRefOrGetter<Element | null>,
  read: () => T,
) {
  const { isHeld } = useKeepAliveState();
  watchSyncEffect((onCleanup) => {
    const node = toValue(element);
    if (node && !isHeld.value) {
      registry.set(node, read);
      onCleanup(() => {
        if (registry.get(node) === read) {
          registry.delete(node);
        }
      });
    }
  });
}
