import { computed, shallowRef, watch } from 'vue';

/**
 * The value of a part with `v-model`: the model while the parent gives one, else the value that
 * the part owns. An absent model, also one that becomes `undefined`, makes the part uncontrolled,
 * and the part keeps the value that it has.
 */
export function useModel<T>(model: () => T | undefined, first: T) {
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
  };
}
