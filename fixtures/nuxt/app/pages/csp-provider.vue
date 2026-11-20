<script setup lang="ts">
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';
import { Tabs } from '@vase-ui/vue/tabs';
</script>

<template>
  <main>
    <div data-testid="providers">
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root data-testid="scroll-area" style="width: 200px; height: 100px">
          <ScrollArea.Viewport style="width: 100%; height: 100%">
            <div style="height: 400px">Content</div>
          </ScrollArea.Viewport>
        </ScrollArea.Root>
        <Tabs.Root data-testid="tabs" default-value="a">
          <Tabs.List style="display: flex; position: relative">
            <Tabs.Tab value="a">A</Tabs.Tab>
            <Tabs.Tab value="b">B</Tabs.Tab>
            <Tabs.Indicator render-before-hydration />
          </Tabs.List>
        </Tabs.Root>
      </CSPProvider>
    </div>
  </main>
</template>
