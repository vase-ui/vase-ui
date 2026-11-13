<script setup lang="ts">
import { ScrollArea } from '../index';
</script>

<template>
  <ScrollArea.Root style="width: 200px; height: 200px; pointer-events: none">
    <ScrollArea.Viewport style="width: 100%; height: 100%">
      <ScrollArea.Content data-testid="content">
        <div style="width: 1000px; height: 1000px" />
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar style="width: 10px">
      <ScrollArea.Thumb />
    </ScrollArea.Scrollbar>
    <ScrollArea.Scrollbar orientation="horizontal" style="height: 10px">
      <ScrollArea.Thumb />
    </ScrollArea.Scrollbar>
    <ScrollArea.Corner data-testid="corner" />
  </ScrollArea.Root>
</template>
