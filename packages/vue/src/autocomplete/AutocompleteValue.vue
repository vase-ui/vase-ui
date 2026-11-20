<script setup lang="ts">
import { injectComboboxRoot } from '../combobox/root';
import type { AutocompleteValueProps } from './types';

defineProps<AutocompleteValueProps>();
defineSlots<{
  /** Formats the text of the input. With no slot, the part shows the text. */
  default?(scope: { value: string }): unknown;
}>();

const context = injectComboboxRoot('Value');
</script>

<template>
  <slot v-if="$slots.default" :value="context.text" />
  <template v-else-if="context.text !== ''">{{ context.text }}</template>
</template>
