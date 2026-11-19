<script setup lang="ts">
import type { PropType } from 'vue';

// Native radios with `:checked`. Their listener sends the value, and the parent can keep its value.
defineProps({ model: { type: Object as PropType<{ value: string | null }>, required: true } });
const emit = defineEmits<{ change: [value: string] }>();
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
      @change="emit('change', value)"
    />
    <button type="reset">Reset</button>
  </form>
</template>
