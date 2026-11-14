<script lang="ts">
export interface AutocompleteValueState {}

export interface AutocompleteValueProps {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useComboboxInputValueContext } from '../../combobox/root/ComboboxRootContext';

defineOptions({ inheritAttrs: false });

defineSlots<{
  /**
   * The content. It gets the text of the input as `value`. With no slot, the part shows that text.
   */
  default?(props: { value: string }): unknown;
}>();

const inputValue = useComboboxInputValueContext();
const value = computed(() => String(inputValue.value));
</script>

<template>
  <slot v-if="$slots.default" :value="value" />
  <template v-else-if="value !== ''">{{ value }}</template>
</template>
