<script setup lang="ts">
import type { PropType } from 'vue';
import { Tabs } from '../../src/tabs';

// Each panel and the tab "a" are in a `<Transition>`. The hooks of each panel write its key, its
// `data-activation-direction` and its classes when its enter or its leave starts.
const props = defineProps({
  root: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ shown: boolean }>, default: () => ({ shown: true }) },
  log: { type: Array as PropType<string[]>, default: () => [] },
});

function record(phase: string, element: Element) {
  props.log.push(
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
