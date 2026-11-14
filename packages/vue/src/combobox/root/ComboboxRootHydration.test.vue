<script setup lang="ts">
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import ComboboxRoot from './ComboboxRoot.vue';

defineProps<{
  locale?: string | undefined;
  name?: string | undefined;
  multiple?: boolean | undefined;
  defaultValue?: string | string[] | undefined;
  defaultInputValue?: string | undefined;
  inline?: boolean | undefined;
}>();

const cities = ['Malmö', 'Malta', 'Oslo'];
</script>

<template>
  <ComboboxRoot
    id="city"
    :items="cities"
    :locale="locale"
    :name="name"
    :multiple="multiple"
    :default-value="defaultValue"
    :default-input-value="defaultInputValue"
    :inline="inline"
    :open="inline ? true : undefined"
  >
    <ComboboxInputPart />
    <ComboboxListPart />
  </ComboboxRoot>
</template>
