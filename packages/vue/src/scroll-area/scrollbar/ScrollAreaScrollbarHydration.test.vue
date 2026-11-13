<script setup lang="ts">
import { ScrollArea } from '../index';
</script>

<template>
  <ScrollArea.Root style="width: 200px; height: 200px; pointer-events: none">
    <ScrollArea.Viewport style="width: 100%; height: 100%">
      <div style="width: 1000px; height: 1000px" />
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar data-testid="kept" keep-mounted />
    <ScrollArea.Scrollbar data-testid="measured" orientation="horizontal" />
  </ScrollArea.Root>
</template>
