<script setup lang="ts">
import { inject, useTemplateRef, watch } from 'vue';

const items = inject<object[]>('items')!;
const input = useTemplateRef<HTMLInputElement>('input');
watch(
  input,
  (element, _, onCleanup) => {
    if (!element) return;
    items.push(element);
    onCleanup(() => items.splice(items.indexOf(element), 1));
  },
  { flush: 'post' },
);
</script>

<template>
  <input ref="input" aria-label="Item" />
</template>
