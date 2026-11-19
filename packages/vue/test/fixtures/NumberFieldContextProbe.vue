<script setup lang="ts">
import NumberFieldInput from '../../src/number-field/input/NumberFieldInput.vue';
import { useValueChanged } from '../../src/internals/useValueChanged';
import { useNumberFieldRootContext } from '../../src/number-field/root/NumberFieldRootContext';
import type { NumberFieldRootContext } from '../../src/number-field/root/NumberFieldRootContext';

const emit = defineEmits<{
  // Runs after the DOM update of each change of the value, as the callback of `useValueChanged` in a
  // part.
  valueChanged: [context: NumberFieldRootContext];
}>();

const context = useNumberFieldRootContext();
const { state } = context;

useValueChanged(
  () => state.value.value,
  () => emit('valueChanged', context),
);

defineExpose({ context });
</script>

<template>
  <NumberFieldInput data-testid="text" />
</template>
