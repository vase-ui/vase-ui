<script setup lang="ts">
import type { PropType } from 'vue';

// Native radios with `:checked`. Their listener gives the value to the parent, and the parent can
// keep its value.
defineProps({
  model: {
    type: Object as PropType<{ value: string | null; write(value: string): void }>,
    required: true,
  },
});
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
      @change="model.write(value)"
    />
    <button type="reset">Reset</button>
  </form>
</template>
