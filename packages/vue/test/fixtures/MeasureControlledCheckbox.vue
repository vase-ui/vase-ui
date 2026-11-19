<script setup lang="ts">
import type { PropType } from 'vue';

// A native checkbox with `:checked` and `:indeterminate`. Its listener sends the new state, and the
// parent can keep its state.
defineProps({
  model: {
    type: Object as PropType<{ checked: boolean; indeterminate: boolean }>,
    required: true,
  },
});
const emit = defineEmits<{ change: [checked: boolean] }>();
</script>

<template>
  <form>
    <input
      type="checkbox"
      aria-label="Box"
      :checked="model.checked"
      :indeterminate="model.indeterminate"
      @change="emit('change', ($event.target as HTMLInputElement).checked)"
    />
    <button type="reset">Reset</button>
  </form>
</template>
