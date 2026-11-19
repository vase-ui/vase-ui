<script setup lang="ts">
import type { PropType } from 'vue';

// A native input with `:value`. Its listener sends the text, and the parent can keep its value.
defineProps({ model: { type: Object as PropType<{ value: string }>, required: true } });
const emit = defineEmits<{ input: [value: string] }>();
</script>

<template>
  <form>
    <input
      :value="model.value"
      aria-label="Text"
      @input="emit('input', ($event.target as HTMLInputElement).value)"
    />
  </form>
</template>
