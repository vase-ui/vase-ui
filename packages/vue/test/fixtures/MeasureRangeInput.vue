<script setup lang="ts">
import type { PropType } from 'vue';

// A native range input with `min`, `max` and `value` in one object for `v-bind`, with `value` last.
// Its listener gives the value to the parent, and the parent can keep its value.
defineProps({
  model: {
    type: Object as PropType<{
      min: number;
      max: number;
      value: number;
      write(value: number): void;
    }>,
    required: true,
  },
});
</script>

<template>
  <input
    v-bind="{ type: 'range', min: model.min, max: model.max, value: model.value }"
    aria-label="Range"
    @input="model.write(($event.target as HTMLInputElement).valueAsNumber)"
  />
</template>
