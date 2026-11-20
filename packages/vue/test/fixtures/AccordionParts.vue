<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Accordion } from '../../src/accordion';

type Item = {
  key: string;
  value?: unknown;
  attrs?: Record<string, unknown>;
  header?: Record<string, unknown>;
  trigger?: Record<string, unknown> | false;
  panel?: Record<string, unknown> | false;
};

// Each item, header, trigger and panel has the `data-key` of its item, and the value of an item is
// `value`, or else its key. The trigger shows "disabled" while its state is disabled. `false` in
// `trigger` or `panel` removes the part. With `panelsFirst`, each panel comes before its header.
// `transition` puts each panel in a `<Transition>` of that name, whose hooks write each phase and
// the key in `log`. Each panel holds a text with the id `<key>-target`.
const props = defineProps({
  root: Object as PropType<Record<string, unknown>>,
  items: { type: Array as PropType<Item[]>, required: true },
  panelsFirst: Boolean,
  transition: String,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => new Set() },
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });

function itemProps(item: Item) {
  return 'value' in item
    ? { value: item.value, ...item.attrs }
    : { value: item.key, ...item.attrs };
}

function record(phase: string, element: Element) {
  props.log.add(`${phase} ${element.getAttribute('data-key')}`);
}
</script>

<template>
  <input aria-label="Before" />
  <Accordion.Root ref="rootPart" v-bind="root">
    <Accordion.Item
      v-for="item in items"
      :key="item.key"
      :data-key="item.key"
      v-bind="itemProps(item)"
    >
      <Accordion.Panel
        v-if="panelsFirst && item.panel !== false"
        :data-key="item.key"
        v-bind="item.panel"
      >
        <p :id="`${item.key}-target`">{{ item.key }} panel</p>
      </Accordion.Panel>
      <Accordion.Header :data-key="item.key" v-bind="item.header">
        <Accordion.Trigger
          v-if="item.trigger !== false"
          v-slot="{ state }"
          :data-key="item.key"
          v-bind="item.trigger"
        >
          {{ item.key }}<span>{{ state.disabled ? ' disabled' : '' }}</span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Transition
        v-if="transition"
        :name="transition"
        @enter="(element: Element) => record('enter', element)"
        @after-enter="(element: Element) => record('after-enter', element)"
        @leave="(element: Element) => record('leave', element)"
        @after-leave="(element: Element) => record('after-leave', element)"
      >
        <Accordion.Panel :data-key="item.key" v-bind="item.panel || {}">
          {{ item.key }} panel
        </Accordion.Panel>
      </Transition>
      <Accordion.Panel
        v-else-if="!panelsFirst && item.panel !== false"
        :data-key="item.key"
        v-bind="item.panel"
      >
        <p :id="`${item.key}-target`">{{ item.key }} panel</p>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion.Root>
  <input aria-label="After" />
</template>

<style>
.accordion-fade-enter-active,
.accordion-fade-leave-active {
  transition: opacity 300ms linear;
}
.accordion-fade-enter-from,
.accordion-fade-leave-to {
  opacity: 0;
}
</style>
