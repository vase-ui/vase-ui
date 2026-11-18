<script setup lang="ts">
import { shallowRef } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import type { NumberFieldRootChangeEventDetails } from '@vase-ui/vue/number-field';

const props = defineProps<{
  // The first value of `v-model`.
  value?: number | undefined;
}>();

const model = shallowRef(props.value ?? null);
const changes = shallowRef<string[]>([]);

function handleValueChange(value: number | null, details: NumberFieldRootChangeEventDetails) {
  changes.value = [...changes.value, `${String(value)} (${details.reason})`];
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <NumberField.Root
      v-model="model"
      name="quantity"
      data-testid="root"
      @value-change="handleValueChange"
    >
      <NumberField.Input data-testid="input" />
    </NumberField.Root>
  </form>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
