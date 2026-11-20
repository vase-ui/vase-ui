<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';
import { Menubar } from '../../src/menubar';

type Props = Record<string, unknown>;

// A bar of three menus with two items each, and an input before and after it. The bar shows its
// slot state.
defineProps({
  bar: Object as PropType<Props>,
  roots: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  triggers: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Menubar v-slot="{ state }" data-testid="bar" v-bind="bar">
    <span data-testid="state"
      >{{ state.hasSubmenuOpen }} {{ state.orientation }} {{ state.modal }}</span
    >
    <Menu.Root v-for="key in ['file', 'edit', 'view']" :key="key" v-bind="roots[key]">
      <Menu.Trigger :data-key="key" v-bind="triggers[key]">{{ key }}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner :data-testid="`${key}-positioner`">
          <Menu.Popup :data-testid="`${key}-popup`">
            <Menu.Item :data-key="`${key}-1`">{{ key }} 1</Menu.Item>
            <Menu.Item :data-key="`${key}-2`">{{ key }} 2</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menubar>
  <input id="after" aria-label="After" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
