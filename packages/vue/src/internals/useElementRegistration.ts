import { toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useKeepAliveState } from './useKeepAliveState';

/** Registers the actual element of a part for the lifetime of its ref outside a hold. */
export function useElementRegistration<T>(
  registry: WeakMap<Element, () => T>,
  element: MaybeRefOrGetter<Element | null>,
  read: () => T,
) {
  const { isHeld } = useKeepAliveState();
  watch(
    () => (isHeld.value ? null : toValue(element)),
    (node, _previous, onCleanup) => {
      if (node) {
        registry.set(node, read);
        onCleanup(() => {
          if (registry.get(node) === read) {
            registry.delete(node);
          }
        });
      }
    },
    { immediate: true, flush: 'sync' },
  );
}
