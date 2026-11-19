<script setup lang="ts">
import { onErrorCaptured } from 'vue';
import { ScrollArea } from '../../src/scroll-area';

const errors: string[] = [];
onErrorCaptured((error) => {
  errors.push((error as Error).message);
  return false;
});
defineExpose({ errors });
</script>

<template>
  <ScrollArea.Viewport />
  <ScrollArea.Scrollbar keep-mounted />
  <ScrollArea.Corner />
  <ScrollArea.Root>
    <ScrollArea.Thumb />
    <ScrollArea.Content />
  </ScrollArea.Root>
</template>
