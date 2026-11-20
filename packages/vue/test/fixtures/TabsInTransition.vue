<script setup lang="ts">
import type { PropType } from 'vue';
import { Tabs } from '../../src/tabs';

// Each panel, the tab "a" and the indicator are in a `<Transition>`. The hooks of each panel write
// its key, its `data-activation-direction` and its classes when its enter or its leave starts. The
// enter and the leave of a panel and of the indicator take 200 ms.
const props = defineProps({
  root: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ shown: boolean }>, default: () => ({ shown: true }) },
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => new Set() },
});

function record(phase: string, element: Element) {
  props.log.add(
    `${phase} ${element.getAttribute('data-key')} ${element.getAttribute('data-activation-direction')} ${element.className}`,
  );
}
</script>

<template>
  <Tabs.Root v-bind="root">
    <Tabs.List>
      <Transition>
        <Tabs.Tab v-if="scene.shown" data-key="a" value="a">A</Tabs.Tab>
      </Transition>
      <Tabs.Tab v-if="scene.shown" data-key="b" value="b">B</Tabs.Tab>
      <Transition name="panel">
        <Tabs.Indicator class="Indicator" />
      </Transition>
    </Tabs.List>
    <Transition
      name="panel"
      @enter="(element: Element) => record('enter', element)"
      @leave="(element: Element) => record('leave', element)"
    >
      <Tabs.Panel data-key="a" value="a">A panel</Tabs.Panel>
    </Transition>
    <Transition
      name="panel"
      @enter="(element: Element) => record('enter', element)"
      @leave="(element: Element) => record('leave', element)"
    >
      <Tabs.Panel data-key="b" value="b">B panel</Tabs.Panel>
    </Transition>
  </Tabs.Root>
</template>

<style>
.panel-enter-active,
.panel-leave-active {
  transition: opacity 200ms linear;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
}
</style>
