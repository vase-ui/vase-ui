<script setup lang="ts">
import type { PropType } from 'vue';

// A native input with `:value`. Its listener gives the text to the parent, and the parent can keep
// its value.
defineProps({
  model: {
    type: Object as PropType<{ value: string; write(value: string): void }>,
    required: true,
  },
});
</script>

<template>
  <form>
    <input
      :value="model.value"
      aria-label="Text"
      @input="model.write(($event.target as HTMLInputElement).value)"
    />
  </form>
</template>
