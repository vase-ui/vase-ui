<script setup lang="ts">
import { computed, useTemplateRef, type PropType } from 'vue';
import { DirectionProvider } from '../../src/direction-provider';
import { Tabs } from '../../src/tabs';

type Item = { key: string; value?: unknown; attrs?: Record<string, unknown> };

// Each tab and each panel has the text and the `data-key` of its key. Its value is `value`, or else
// its key. With no `panels`, each tab has one panel. Text inputs stand before and after the root,
// because WebKit on macOS gives Tab no button. `dir` is the `dir` of an element around the root, and
// `providedDirection` the direction of a `DirectionProvider` around it. With `nested`, the first panel
// after the list holds another root.
const props = defineProps({
  root: Object as PropType<Record<string, unknown>>,
  list: Object as PropType<Record<string, unknown>>,
  tabs: { type: Array as PropType<Item[]>, required: true },
  panels: Array as PropType<Item[]>,
  indicator: Object as PropType<Record<string, unknown>>,
  panelsFirst: Boolean,
  dir: String,
  providedDirection: { type: String as PropType<'ltr' | 'rtl'>, default: 'ltr' },
  nested: Boolean,
});
const rootPart = useTemplateRef('rootPart');
const listPart = useTemplateRef('listPart');
const indicatorPart = useTemplateRef('indicatorPart');
defineExpose({ root: rootPart, list: listPart, indicator: indicatorPart });
const panelItems = computed(
  () =>
    props.panels ??
    props.tabs.map((tab): Item =>
      'value' in tab ? { key: tab.key, value: tab.value } : { key: tab.key },
    ),
);

function valueOf(item: Item) {
  return 'value' in item ? item.value : item.key;
}
</script>

<template>
  <input id="before" aria-label="Before" />
  <DirectionProvider :direction="providedDirection">
    <div :dir="dir">
      <Tabs.Root ref="rootPart" v-bind="root">
        <template v-if="panelsFirst">
          <Tabs.Panel
            v-for="panel in panelItems"
            :key="panel.key"
            :data-key="panel.key"
            :value="valueOf(panel)"
            v-bind="panel.attrs"
          >
            {{ panel.key }} panel
          </Tabs.Panel>
        </template>
        <Tabs.List ref="listPart" v-bind="list">
          <Tabs.Tab
            v-for="tab in tabs"
            :key="tab.key"
            :data-key="tab.key"
            :value="valueOf(tab)"
            v-bind="tab.attrs"
          >
            {{ tab.key }}
          </Tabs.Tab>
          <Tabs.Indicator v-if="indicator" ref="indicatorPart" v-bind="indicator" />
        </Tabs.List>
        <template v-if="!panelsFirst">
          <Tabs.Panel
            v-for="(panel, index) in panelItems"
            :key="panel.key"
            :data-key="panel.key"
            :value="valueOf(panel)"
            v-bind="panel.attrs"
          >
            {{ panel.key }} panel
            <Tabs.Root v-if="nested && index === 0" default-value="x">
              <Tabs.List>
                <Tabs.Tab data-key="x" value="x">x</Tabs.Tab>
                <Tabs.Tab data-key="y" value="y">y</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel data-key="x" value="x">x panel</Tabs.Panel>
              <Tabs.Panel data-key="y" value="y">y panel</Tabs.Panel>
            </Tabs.Root>
          </Tabs.Panel>
        </template>
      </Tabs.Root>
    </div>
  </DirectionProvider>
  <input id="after" aria-label="After" />
</template>
