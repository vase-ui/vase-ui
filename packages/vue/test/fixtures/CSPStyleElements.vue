<script setup lang="ts">
import type { PropType } from 'vue';
import { CSPProvider, type CSPProviderProps } from '../../src/csp-provider';
import { ScrollArea } from '../../src/scroll-area';
import { Select } from '../../src/select';
import { Tabs } from '../../src/tabs';

// The parts that render a style or a script element, below a provider with `csp`. A scroll area
// hides its native scrollbar with a style element, and so does the popup of a select with a scroll
// arrow. A tab indicator with `renderBeforeHydration` renders a script in the server HTML.
defineProps({
  part: { type: String as PropType<'scroll-area' | 'select' | 'tabs'>, required: true },
  csp: { type: Object as PropType<CSPProviderProps>, default: () => ({}) },
});
</script>

<template>
  <CSPProvider v-bind="csp">
    <ScrollArea.Root v-if="part === 'scroll-area'" class="ScrollArea">
      <ScrollArea.Viewport class="Viewport">Content</ScrollArea.Viewport>
    </ScrollArea.Root>
    <Select.Root v-else-if="part === 'select'" default-open>
      <Select.Trigger><Select.Value /></Select.Trigger>
      <Select.Portal>
        <Select.Positioner :align-item-with-trigger="false">
          <Select.Popup class="Popup">
            <Select.ScrollUpArrow />
            <Select.Item value="a">a</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
    <Tabs.Root v-else default-value="a">
      <Tabs.List style="display: flex; position: relative">
        <Tabs.Tab value="a">a</Tabs.Tab>
        <Tabs.Indicator class="Indicator" render-before-hydration />
      </Tabs.List>
    </Tabs.Root>
  </CSPProvider>
</template>
