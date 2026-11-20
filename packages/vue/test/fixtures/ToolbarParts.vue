<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toolbar } from '../../src/toolbar';
import ToolbarItem, { type ToolbarFixtureItem } from './ToolbarItem.vue';

type Entry =
  | ToolbarFixtureItem
  | { key: string; group: ToolbarFixtureItem[]; attrs?: Record<string, unknown> };

defineProps({
  root: Object as PropType<Record<string, unknown>>,
  items: { type: Array as PropType<Entry[]>, required: true },
});
const rootPart = useTemplateRef('rootPart');
defineExpose({ root: rootPart });
</script>

<template>
  <!-- WebKit on macOS gives Tab no button, so text inputs stand around the toolbar. -->
  <input id="before" aria-label="Before" />
  <Toolbar.Root ref="rootPart" v-slot="{ state }" v-bind="root">
    <template v-for="entry in items" :key="entry.key">
      <Toolbar.Group
        v-if="'group' in entry"
        :id="entry.key"
        v-slot="{ state: group }"
        v-bind="entry.attrs"
      >
        <ToolbarItem v-for="item in entry.group" :key="item.key" :item="item" />
        <span class="GroupState">{{ group.disabled }} {{ group.orientation }}</span>
      </Toolbar.Group>
      <ToolbarItem v-else :item="entry" />
    </template>
    <span class="State">{{ state.disabled }} {{ state.orientation }}</span>
  </Toolbar.Root>
  <input id="after" aria-label="After" />
</template>
