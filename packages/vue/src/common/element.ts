import { computed, shallowRef } from 'vue';

/**
 * The element that a part renders, from the function ref that the part binds to it. The part
 * renders it, or the developer renders it in the `element` slot and binds `elementRef`, because
 * Vapor ignores `ref` in `v-bind`. A component in the slot exposes its element as `element`,
 * because a Vapor component has no `$el`.
 */
export function useElement<T extends Element>() {
  const target = shallowRef<unknown>(null);
  const element = computed(() => {
    const value = target.value as Element | { element?: Element } | null;
    // On the server, the ref stays empty and `Element` does not exist.
    if (!value) return null;
    return (value instanceof Element ? value : (value.element ?? null)) as T | null;
  });
  function setElement(value: unknown) {
    target.value = value;
  }
  return { element, setElement };
}
