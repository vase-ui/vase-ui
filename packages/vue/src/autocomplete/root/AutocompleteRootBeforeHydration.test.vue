<script setup lang="ts">
import { shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import type { AutocompleteRootChangeEventDetails } from '@vase-ui/vue/autocomplete';

const cities = ['Malmö', 'Malta', 'Oslo'];
const value = shallowRef('');
const changes = shallowRef<string[]>([]);

function handleValueChange(nextValue: string, details: AutocompleteRootChangeEventDetails) {
  changes.value = [...changes.value, `${nextValue} (${details.reason})`];
}
</script>

<template>
  <Autocomplete.Root v-model:value="value" :items="cities" @value-change="handleValueChange">
    <Autocomplete.Input data-testid="input" />
  </Autocomplete.Root>
  <output data-testid="value">{{ value }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
