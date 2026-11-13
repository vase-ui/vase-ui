<script setup lang="ts">
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
</script>

<template>
  <main>
    <CSPProvider nonce="test-nonce">
      <ScrollArea.Root data-testid="root" style="width: 200px; height: 200px">
        <ScrollArea.Viewport data-testid="viewport" style="width: 100%; height: 100%">
          <ScrollArea.Content>
            <div style="width: 1000px; height: 1000px" />
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar data-testid="scrollbar" keep-mounted style="width: 10px">
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar orientation="horizontal" style="height: 10px">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner data-testid="corner" />
      </ScrollArea.Root>
      <ScrollArea.Root data-testid="second-root">
        <ScrollArea.Viewport data-testid="second-viewport" />
      </ScrollArea.Root>
    </CSPProvider>
  </main>
</template>
