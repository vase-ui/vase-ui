<script setup lang="ts">
import { useTemplateRef, watch } from 'vue';

// Registers its element as a control registers with its field: after the render, until the
// unmount.
const props = defineProps({ name: { type: String, required: true } });
const emit = defineEmits<{ log: [entry: string] }>();
const input = useTemplateRef<HTMLInputElement>('input');
watch(
  input,
  (element, _, onCleanup) => {
    if (!element) return;
    emit('log', `add ${props.name}`);
    onCleanup(() => emit('log', `remove ${props.name}`));
  },
  { flush: 'post' },
);
</script>

<template>
  <input ref="input" :aria-label="name" />
</template>
