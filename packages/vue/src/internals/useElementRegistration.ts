import { watch } from 'vue';
import type { Ref } from 'vue';
import { useKeepAliveState } from './useKeepAliveState';

/** Registers the actual element of a part for the lifetime of its ref outside a hold. */
export function useElementRegistration<T>(
  registry: WeakMap<Element, () => T>,
  element: Readonly<Ref<Element | null>>,
  read: () => T,
) {
  const { isHeld } = useKeepAliveState();
  watch(
    [element, isHeld],
    ([node, held], _previous, onCleanup) => {
      if (node && !held) {
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
