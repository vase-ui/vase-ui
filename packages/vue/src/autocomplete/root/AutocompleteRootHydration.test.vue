<script setup lang="ts">
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import * as Autocomplete from '../index.parts';

// With `noInput`, the root has no input outside the popup, as when the input is in a closed popup.
defineProps<{
  locale?: string | undefined;
  name?: string | undefined;
  defaultValue?: string | undefined;
  inline?: boolean | undefined;
  mode?: 'list' | 'both' | 'inline' | 'none' | undefined;
  readOnly?: boolean | undefined;
  noInput?: boolean | undefined;
}>();

const cities = ['Malmö', 'Malta', 'Oslo'];
</script>

<template>
  <Autocomplete.Root
    id="city"
    :items="cities"
    :locale="locale"
    :name="name"
    :default-value="defaultValue"
    :inline="inline"
    :mode="mode"
    :read-only="readOnly"
    :open="inline ? true : undefined"
  >
    <Autocomplete.Input v-if="!noInput" data-testid="input" />
    <span data-testid="value"><Autocomplete.Value /></span>
    <ComboboxListPart />
  </Autocomplete.Root>
</template>
