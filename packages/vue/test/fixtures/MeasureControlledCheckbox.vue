<script setup lang="ts">
import type { PropType } from 'vue';

// A native checkbox with `:checked` and `:indeterminate`. Its listener gives the new state to the
// parent, and the parent can keep its state.
defineProps({
  model: {
    type: Object as PropType<{
      checked: boolean;
      indeterminate: boolean;
      write(checked: boolean): void;
    }>,
    required: true,
  },
});
</script>

<template>
  <form>
    <input
      type="checkbox"
      aria-label="Box"
      :checked="model.checked"
      :indeterminate="model.indeterminate"
      @change="model.write(($event.target as HTMLInputElement).checked)"
    />
    <button type="reset">Reset</button>
  </form>
</template>
