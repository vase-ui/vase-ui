<!-- @strictTemplates true -->
<script setup lang="ts">
import { ScrollArea } from '@vase-ui/vue/scroll-area';
</script>

<!-- A part of Scroll Area takes the native attributes of its element in a template. -->
<template>
  <ScrollArea.Root :overflow-edge-threshold="{ yStart: 8 }" title="Notes">
    <ScrollArea.Viewport role="region" aria-label="Notes" tabindex="0" @scroll="() => {}">
      <ScrollArea.Content title="Notes" />
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar orientation="horizontal" keep-mounted aria-hidden="false">
      <ScrollArea.Thumb title="Thumb" @pointerdown="() => {}" />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner title="Corner" />
  </ScrollArea.Root>
  <!-- @vue-expect-error `orientation` is `'vertical'` or `'horizontal'` -->
  <ScrollArea.Scrollbar orientation="diagonal" />
  <!-- @vue-expect-error `overflowEdgeThreshold` is a number or an object of numbers -->
  <ScrollArea.Root overflow-edge-threshold="8" />
  <!-- @vue-expect-error `title` is a string -->
  <ScrollArea.Viewport :title="5" />
</template>
