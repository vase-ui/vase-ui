<script setup lang="ts">
import { CSPProvider } from '../../src/csp-provider';
import { ScrollArea } from '../../src/scroll-area';

defineProps({ nonce: String, disableStyleElements: Boolean });
</script>

<template>
  <CSPProvider :nonce="nonce" :disable-style-elements="disableStyleElements">
    <ScrollArea.Root class="root" style="width: 200px; height: 200px">
      <ScrollArea.Viewport class="viewport" style="width: 100%; height: 100%">
        <ScrollArea.Content class="content">
          <div style="width: 1000px; height: 1000px" />
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar keep-mounted class="vertical" style="width: 10px">
        <ScrollArea.Thumb class="thumb-y" />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar orientation="horizontal" class="horizontal" style="height: 10px">
        <ScrollArea.Thumb />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner class="corner" />
    </ScrollArea.Root>
  </CSPProvider>
</template>
