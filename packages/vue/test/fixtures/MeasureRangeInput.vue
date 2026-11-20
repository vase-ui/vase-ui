<script setup lang="ts">
import type { PropType } from 'vue';

// A native range input with `value`, `min` and `max` in one object for `v-bind`, with `value` first.
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
    v-bind="{ type: 'range', value: model.value, min: model.min, max: model.max }"
    aria-label="Range"
    @input="model.write(($event.target as HTMLInputElement).valueAsNumber)"
  />
</template>
