<script setup lang="ts">
import { useValueChanged } from '../../src/internals/useValueChanged';
import { useNumberFieldRootContext } from '../../src/number-field/root/NumberFieldRootContext';
import type { NumberFieldRootContext } from '../../src/number-field/root/NumberFieldRootContext';

// A part that reads the context of the root, as `NumberField.Input` does, and gives it to a test as
// `context`. It renders a text input with the test id `text`. The element ref, the `inputmode`, the
// text and the wheel listener come from the context.
const emit = defineEmits<{
  // Runs after the DOM update of each change of the value, as the callback of `useValueChanged` in a
  // part.
  valueChanged: [context: NumberFieldRootContext];
}>();

const context = useNumberFieldRootContext();
const { inputRef, inputMode, isWheelScrubEnabled, onInputWheel, state } = context;

useValueChanged(
  () => state.value.value,
  () => emit('valueChanged', context),
);

function setInputRef(element: unknown) {
  inputRef.value = element as HTMLInputElement | null;
}

function inputProps() {
  return {
    ref: setInputRef,
    'data-testid': 'text',
    inputmode: inputMode.value,
    value: state.value.inputValue,
    onWheel: isWheelScrubEnabled.value ? onInputWheel : undefined,
  };
}

defineExpose({ context });
</script>

<template>
  <input v-bind="inputProps()" />
</template>
