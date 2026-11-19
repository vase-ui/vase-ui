<script setup lang="ts">
import { useTemplateRef, watch, type PropType } from 'vue';

// Registers its element as a control registers with its field: after the render, until the
// unmount.
const props = defineProps({
  name: { type: String, required: true },
  log: { type: Array as PropType<string[]>, required: true },
});
const input = useTemplateRef<HTMLInputElement>('input');
watch(
  input,
  (element, _, onCleanup) => {
    if (!element) return;
    props.log.push(`add ${props.name}`);
    onCleanup(() => props.log.push(`remove ${props.name}`));
  },
  { flush: 'post' },
);
</script>

<template>
  <input ref="input" :aria-label="name" />
</template>
