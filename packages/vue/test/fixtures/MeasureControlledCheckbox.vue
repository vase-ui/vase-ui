<script setup lang="ts">
import type { PropType } from 'vue';

// A native checkbox with `:checked` and `:indeterminate`. Its listener writes `checked` to the
// model only with `accept`.
const props = defineProps({
  model: {
    type: Object as PropType<{ checked: boolean; indeterminate: boolean; accept: boolean }>,
    required: true,
  },
});

function onChange(event: Event) {
  if (props.model.accept) props.model.checked = (event.target as HTMLInputElement).checked;
}
</script>

<template>
  <form>
    <input
      type="checkbox"
      aria-label="Box"
      :checked="model.checked"
      :indeterminate="model.indeterminate"
      @change="onChange"
    />
    <button type="reset">Reset</button>
  </form>
</template>
