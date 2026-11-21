import { computed, shallowRef, watch } from 'vue';

/**
 * The value of a part with `v-model`: the model while the parent gives one, else the value that
 * the part owns. An absent model, also one that becomes `undefined`, makes the part uncontrolled,
 * and the part keeps the value that it has.
 */
export function useModel<T>(model: () => T | undefined, first: T) {
  const firstModel = model();
  // The items of an array model at the mount, which an edit of the array in place does not change.
  const firstItems: unknown[] | undefined = Array.isArray(firstModel) ? [...firstModel] : undefined;
  const own = shallowRef(first);
  const value = computed(() => {
    const given = model();
    return given === undefined ? own.value : given;
  });
  watch(value, (next) => (own.value = next));
  return {
    value,
    /**
     * Sets the value that the part owns. While the parent controls the value, the part keeps the
     * value of the parent, also after a value that the parent refused.
     */
    setOwn(next: T) {
      if (model() === undefined) own.value = next;
    },
    /**
     * The value that a native reset of the form gives: the model of the mount, else the default
     * value that the part has now, as a native control resets to its current default.
     */
    resetValue(defaultValue: T): T {
      if (firstModel === undefined) return defaultValue;
      const items = firstModel as unknown[];
      // An array with its items of the mount stays the same array, because a part can compare a
      // value with the value of an item by identity.
      const edited =
        firstItems &&
        (firstItems.length !== items.length ||
          firstItems.some((item, index) => !Object.is(item, items[index])));
      return edited ? (firstItems as T) : firstModel;
    },
  };
}
