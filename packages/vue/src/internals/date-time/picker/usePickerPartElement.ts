import { computed, onBeforeUnmount, shallowRef, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
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
  const first = computed(() => {
    const elements = getters.value.map((get) => get());
    // An app can mount in an element that it adds to the document later. Vue reports no such
    // move, so the registry gives the element from the mount on.
    return getFirstInDocument(elements) ?? elements.find((element) => element !== null) ?? null;
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
