import { computed, onBeforeUnmount, shallowRef, toValue, triggerRef, watchPostEffect } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { observeRootNode } from '../../observeRootNode';
import { useKeepAliveState } from '../../useKeepAliveState';
import { getFirstInDocument } from './usePickerPopup';

/** The elements of one kind of picker part, such as its fields or its triggers. */
export interface PickerPartElements {
  /**
   * The first element in the document that a part gives, or `null`. While no such element is in
   * the document, it is the first element in the order of the registrations.
   */
  first: ComputedRef<HTMLElement | null>;
  /** Adds the getter of a part and returns the function that removes it. */
  add: (element: () => HTMLElement | null) => () => void;
}

/** A picker root creates one registry for each kind of part that gives it an element. */
export function createPickerPartElements(): PickerPartElements {
  const getters = shallowRef<(() => HTMLElement | null)[]>([]);
  const elements = computed(() => getters.value.map((get) => get()).filter((el) => el !== null));
  const readFirst = () => getFirstInDocument(elements.value) ?? elements.value[0] ?? null;
  const first = computed(readFirst);

  watchPostEffect((onCleanup) => {
    if (elements.value.length < 2) {
      return;
    }
    // A keyed move can change DOM order without replacing any part's ref.
    function checkOrder() {
      if (first.value !== readFirst()) {
        triggerRef(getters);
      }
    }
    checkOrder();
    for (const element of elements.value) {
      onCleanup(observeRootNode(element, checkOrder));
    }
  });

  function add(element: () => HTMLElement | null) {
    getters.value = [...getters.value, element];
    return () => {
      getters.value = getters.value.filter((get) => get !== element);
    };
  }

  return { first, add };
}

/** Call in `setup`. A part gives no element while `KeepAlive` holds it. */
export function usePickerPartElement(
  parts: PickerPartElements,
  element: MaybeRefOrGetter<HTMLElement | null>,
): void {
  const { isHeld } = useKeepAliveState();
  // A leave transition can keep the element in the document after the part unmounts.
  onBeforeUnmount(parts.add(() => (isHeld.value ? null : toValue(element))));
}
