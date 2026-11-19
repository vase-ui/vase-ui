<script setup lang="ts">
import { useTemplateRef, watch, type PropType } from 'vue';

// Registers its element as a control registers with its field: after the render, until the
// unmount. A Vapor app reads a root prop that is a function as a getter, so the log is an object.
const props = defineProps({
  name: { type: String, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
const input = useTemplateRef<HTMLInputElement>('input');
watch(
  input,
  (element, _, onCleanup) => {
    if (!element) return;
    props.log.add(`add ${props.name}`);
    onCleanup(() => props.log.add(`remove ${props.name}`));
  },
  { flush: 'post' },
);
</script>

<template>
  <input ref="input" :aria-label="name" />
</template>
