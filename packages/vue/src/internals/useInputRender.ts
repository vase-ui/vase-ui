import { shallowRef, toValue } from 'vue';

// A refused edit leaves the model unchanged. The revision gives Vue a reason to patch the input.
export function useInputRender() {
  const revision = shallowRef(0);
  function valueProps<Value>(value: Value) {
    toValue(revision);
    return { value };
  }
  function renderValue() {
    revision.value += 1;
  }
  return { valueProps, renderValue };
}
