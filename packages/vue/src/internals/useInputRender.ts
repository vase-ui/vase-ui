import { shallowRef, toValue } from 'vue';

// A refused edit leaves the model unchanged. Read the revision in the binding so Vue patches
// the same input and keeps its focus and selection.
export function useInputRender() {
  const revision = shallowRef(0);
  return {
    valueProps<Value>(value: Value) {
      toValue(revision);
      return { value };
    },
    renderValue() {
      revision.value += 1;
    },
  };
}
