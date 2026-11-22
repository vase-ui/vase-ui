<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';
import { Menubar } from '../../src/menubar';

type Props = Record<string, unknown>;

// A bar of three menus with two items each, and an input before and after it. The bar shows its
// slot state. With `submenus`, the first menu has a submenu `share`, and the last menu has a submenu
// `layout` with a radio group. With `filter`, the first menu has a filter. `triggerless` adds a
// menu with no trigger to the bar.
defineProps({
  bar: Object as PropType<Props>,
  roots: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  triggers: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  portals: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  positioners: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  submenus: Boolean,
  filter: Boolean,
  triggerless: Object as PropType<Props>,
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Menubar v-slot="{ state }" data-testid="bar" v-bind="bar">
    <span data-testid="state"
      >{{ state.hasSubmenuOpen }} {{ state.orientation }} {{ state.modal }}</span
    >
    <template v-if="filter">
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger data-key="file">file</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="file-popup">
                <Menu.Input data-testid="input" aria-label="Filter" />
                <Menu.List>
                  <Menu.Item data-key="file-1">New file</Menu.Item>
                  <Menu.Item data-key="file-2">Open file</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
      <Menu.Root>
        <Menu.Trigger data-key="edit">edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="edit-popup">
              <Menu.Item data-key="edit-1">Copy</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </template>
    <template v-else>
      <Menu.Root v-for="key in ['file', 'edit', 'view']" :key="key" v-bind="roots[key]">
        <Menu.Trigger :data-key="key" v-bind="triggers[key]">{{ key }}</Menu.Trigger>
        <Menu.Portal v-bind="portals[key]">
          <Menu.Positioner :data-testid="`${key}-positioner`" v-bind="positioners[key]">
            <Menu.Popup :data-testid="`${key}-popup`">
              <Menu.Item :data-key="`${key}-1`">{{ key }} 1</Menu.Item>
              <Menu.Item :data-key="`${key}-2`">{{ key }} 2</Menu.Item>
              <Menu.SubmenuRoot v-if="submenus && key === 'file'">
                <Menu.SubmenuTrigger data-key="share" :delay="0">Share</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="share-popup">
                      <Menu.Item data-key="share-1">Email</Menu.Item>
                      <Menu.Item data-key="share-2">Print</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
              <Menu.SubmenuRoot v-if="submenus && key === 'view'">
                <Menu.SubmenuTrigger data-key="layout" :delay="0">Layout</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="layout-popup">
                      <Menu.RadioGroup default-value="single">
                        <Menu.RadioItem data-key="layout-1" value="single">Single</Menu.RadioItem>
                        <Menu.RadioItem data-key="layout-2" value="two">Two</Menu.RadioItem>
                      </Menu.RadioGroup>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </template>
    <Menu.Root v-if="triggerless" v-bind="triggerless">
      <Menu.Portal keep-mounted>
        <Menu.Positioner>
          <Menu.Popup data-testid="triggerless-popup">
            <Menu.Item>Item</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menubar>
  <input id="after" aria-label="After" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
