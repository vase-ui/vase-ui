<script setup lang="ts">
import type { PropType } from 'vue';

// A native input with `:value`. Its listener writes the text to the model only with `accept`.
const props = defineProps({
  model: { type: Object as PropType<{ value: string; accept: boolean }>, required: true },
});

function onInput(event: Event) {
  if (props.model.accept) props.model.value = (event.target as HTMLInputElement).value;
}
</script>

<template>
  <form>
    <input :value="model.value" aria-label="Text" @input="onInput" />
  </form>
</template>
