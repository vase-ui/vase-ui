<script setup lang="ts">
import { shallowRef } from 'vue';
import ComboboxInputPart from '../../../test/fixtures/ComboboxInputPart.vue';
import ComboboxListPart from '../../../test/fixtures/ComboboxListPart.vue';
import ComboboxRoot from './ComboboxRoot.vue';
import type { ComboboxRootChangeEventDetails } from './ComboboxRoot.vue';

const props = defineProps<{
  // The first value of `v-model:value`.
  value?: string | undefined;
}>();

const cities = ['Malmö', 'Malta', 'Oslo'];
const model = shallowRef<string | null>(props.value ?? null);
const changes = shallowRef<string[]>([]);

function handleValueChange(value: unknown, details: ComboboxRootChangeEventDetails) {
  changes.value = [...changes.value, `${String(value)} (${details.reason})`];
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <ComboboxRoot
      v-model:value="model"
      name="city"
      :items="cities"
      @value-change="handleValueChange"
    >
      <ComboboxInputPart />
      <ComboboxListPart />
    </ComboboxRoot>
  </form>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
