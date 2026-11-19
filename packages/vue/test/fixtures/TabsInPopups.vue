<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Popover } from '../../src/popover';
import { Tabs } from '../../src/tabs';
import { Toolbar } from '../../src/toolbar';

// The same tabs in a Popover, in a Dialog, or in a Toolbar with a button in a panel, a button
// beside the panels and a button after the root.
defineProps({
  host: { type: String as PropType<'popover' | 'dialog' | 'toolbar'>, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => new Set() },
});
</script>

<template>
  <Popover.Root v-if="host === 'popover'">
    <Popover.Trigger>Open</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner :side-offset="8">
        <Popover.Popup>
          <Tabs.Root default-value="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="projects">Projects</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview">Overview panel</Tabs.Panel>
            <Tabs.Panel value="projects">Projects panel</Tabs.Panel>
          </Tabs.Root>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
  <Dialog.Root v-else-if="host === 'dialog'">
    <Dialog.Trigger>Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup>
        <Tabs.Root default-value="overview">
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="projects">Projects</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="overview">Overview panel</Tabs.Panel>
          <Tabs.Panel value="projects">Projects panel</Tabs.Panel>
        </Tabs.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <div v-else @keydown="log.add(`ancestor ${$event.key}`)">
    <Toolbar.Root>
      <Tabs.Root default-value="overview">
        <Tabs.List @keydown="log.add(`list ${$event.key}`)">
          <Tabs.Tab value="overview" @keydown="log.add(`tab ${$event.key}`)">Overview</Tabs.Tab>
          <Tabs.Tab value="projects">Projects</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">
          <Toolbar.Button>In a panel</Toolbar.Button>
        </Tabs.Panel>
        <Toolbar.Button>In the root</Toolbar.Button>
        <Tabs.Panel value="projects" keep-mounted />
      </Tabs.Root>
      <Toolbar.Button>After the root</Toolbar.Button>
    </Toolbar.Root>
  </div>
</template>
