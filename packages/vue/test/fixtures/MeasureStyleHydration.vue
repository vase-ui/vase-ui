<script setup lang="ts">
import { computed, type PropType } from 'vue';

// One element whose attributes come from `state` in one object for `v-bind`, as a part gives
// them. A server render and a hydration can give it other values, to see what Vue compares and
// what it writes.
const props = defineProps({
  state: {
    type: Object as PropType<{
      flex: string;
      allow?: boolean;
      label?: string;
      data?: string;
      marker?: string | null | undefined;
    }>,
    required: true,
  },
});
const attributes = computed(() => ({
  style: { flex: props.state.flex },
  'data-allow-mismatch': props.state.allow ? 'style' : undefined,
  'aria-label': props.state.label,
  'data-state': props.state.data,
  'data-marker': props.state.marker,
}));
</script>

<template>
  <div v-bind="attributes" />
</template>
