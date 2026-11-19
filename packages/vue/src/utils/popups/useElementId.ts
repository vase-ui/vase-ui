import { onScopeDispose, shallowRef, watch } from 'vue';
import type { Ref, ShallowRef } from 'vue';
import { createElementIdObserver } from './usePopupRoot';

/**
 * Gives a ref of the `id` of the element that `element` holds. The ref follows a change of the
 * element and each change of the attribute. It is `undefined` while there is no element. Call it
 * in `setup`.
 *
 * A part that renders the `id` of the element of another part reads this ref. A render does not
 * follow a read of the DOM.
 */
export function useElementId(
  element: Readonly<Ref<Element | null | undefined>>,
): Readonly<ShallowRef<string | undefined>> {
  const id = shallowRef<string | undefined>(undefined);
  const observeId = createElementIdObserver(() => {
    id.value = element.value?.id;
  });
  // The id changes in the write that changes the element. Thus no reader, also outside a render,
  // gets the id of the element before.
  watch(
    element,
    (value) => {
      id.value = observeId(value ?? null);
    },
    { immediate: true, flush: 'sync' },
  );
  // The element can stay in the document after the part goes. It then keeps the observer, the
  // callback and what the callback holds.
  onScopeDispose(() => observeId(null));
  return id;
}
