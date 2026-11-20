<script setup lang="ts">
import type { PropType } from 'vue';
import { Autocomplete } from '../../src/autocomplete';
import { Combobox } from '../../src/combobox';

// Exposes the filter of `useFilter` of the family, with a getter of `options`.
const props = defineProps({
  family: { type: String as PropType<'combobox' | 'autocomplete'>, required: true },
  options: Object as PropType<Record<string, unknown>>,
});
const filter =
  props.family === 'combobox'
    ? Combobox.useFilter(() => props.options ?? {})
    : Autocomplete.useFilter(() => props.options ?? {});
defineExpose({ filter });
</script>

<template>
  <span />
</template>
