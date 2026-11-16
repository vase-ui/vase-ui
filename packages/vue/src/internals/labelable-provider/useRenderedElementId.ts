import { computed, onMounted, shallowRef, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useElementId } from '../../utils/popups/useElementId';

/**
 * Gives the `id` of the element of a part, from the mount on. A `#render` slot can give that
 * element another `id` than the part gives. The result follows each change of the attribute.
 *
 * The result is `undefined` before the mount, on a server and while the element has no `id`. The
 * server HTML and the hydration thus keep the ids that the parts give. The composable reads
 * `element` only after the mount, so a part can give a getter of an element that its `setup`
 * makes later.
 */
export function useRenderedElementId(
  element: MaybeRefOrGetter<Element | null | undefined>,
): ComputedRef<string | undefined> {
  const isMounted = shallowRef(false);
  onMounted(() => {
    isMounted.value = true;
  });
  const id = useElementId(computed(() => (isMounted.value ? (toValue(element) ?? null) : null)));
  return computed(() => id.value || undefined);
}
