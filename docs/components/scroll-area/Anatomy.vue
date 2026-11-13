<script setup lang="ts">
import { ScrollArea } from '@vase-ui/vue/scroll-area';
</script>

<template>
  <ScrollArea.Root>
    <ScrollArea.Viewport>
      <ScrollArea.Content />
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar>
      <ScrollArea.Thumb />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner />
  </ScrollArea.Root>
</template>
