<script setup lang="ts">
import type { PropType } from 'vue';

// Native radios with `:checked`. Their listener writes the value to the model only with `accept`.
const props = defineProps({
  model: {
    type: Object as PropType<{ value: string | null; accept: boolean }>,
    required: true,
  },
});

function onChange(event: Event) {
  if (props.model.accept) props.model.value = (event.target as HTMLInputElement).value;
}
</script>

<template>
  <form>
    <input
      v-for="value in ['a', 'b']"
      :key="value"
      type="radio"
      name="g"
      :value="value"
      :aria-label="value"
      :checked="model.value === value"
      @change="onChange"
    />
    <button type="reset">Reset</button>
  </form>
</template>
