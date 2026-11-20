<script setup lang="ts">
import type { PropType } from 'vue';

// A native number input and a text input with `:value`, and an attribute that changes for
// another cause.
defineProps({
  model: { type: Object as PropType<{ value: string; other: number }>, required: true },
});
</script>

<template>
  <form>
    <input type="number" step="2" :value="model.value" aria-label="Number" />
    <input :value="model.value" :data-other="model.other" aria-label="Text" />
  </form>
</template>
