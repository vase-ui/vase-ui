<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';
import { Menubar } from '../../src/menubar';
import MenubarMenu from './MenubarMenu.vue';

type Props = Record<string, unknown>;

// A bar of three menus `file`, `edit` and `view` with two items each, and an input before and after
// it. The bar shows its slot state. `form` gives the roots of the menus:
// - `contained`: a root around each trigger, with the props `roots[key]`;
// - `multiple`: one root in the bar with the three triggers, with the props `root`;
// - `detached`: one root after the bar, and the three triggers in the bar have its handle;
// - `mixed`: a root around the trigger `file`, and one root after the bar for the triggers `edit`
//   and `view`, with the props `root`.
// A trigger gives its key as the payload. With `submenus`, the first menu has a submenu `share`, and
// the last menu has a submenu `layout` with a radio group. With `filter`, the first menu has a
// filter. `triggerless` adds a menu with no trigger to the bar. With `help`, a trigger `help` after
// the bar has the handle too.
const props = defineProps({
  form: {
    type: String as PropType<'contained' | 'multiple' | 'detached' | 'mixed'>,
    default: 'contained',
  },
  bar: Object as PropType<Props>,
  root: Object as PropType<Props>,
  roots: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  triggers: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  portals: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  positioners: { type: Object as PropType<Record<string, Props>>, default: () => ({}) },
  submenus: Boolean,
  filter: Boolean,
  triggerless: Object as PropType<Props>,
  help: Boolean,
});
const handle = Menu.createHandle<string>();
const keys = ['file', 'edit', 'view'];
const withRoot = (key: string) =>
  props.form === 'contained' || (props.form === 'mixed' && key === 'file');
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
    <Menu.Root v-else-if="form === 'multiple'" v-slot="{ payload }" v-bind="root">
      <Menu.Trigger
        v-for="key in keys"
        :key="key"
        :payload="key"
        :data-key="key"
        v-bind="triggers[key]"
        >{{ key }}</Menu.Trigger
      >
      <MenubarMenu
        v-if="payload"
        :menu="payload as string"
        :submenus
        :portal="portals[payload as string]"
        :positioner="positioners[payload as string]"
      />
    </Menu.Root>
    <template v-else>
      <template v-for="key in keys" :key="key">
        <Menu.Root v-if="withRoot(key)" v-bind="roots[key]">
          <Menu.Trigger :data-key="key" :payload="key" v-bind="triggers[key]">{{
            key
          }}</Menu.Trigger>
          <MenubarMenu
            :menu="key"
            :submenus
            :portal="portals[key]"
            :positioner="positioners[key]"
          />
        </Menu.Root>
        <Menu.Trigger v-else :handle :payload="key" :data-key="key" v-bind="triggers[key]">{{
          key
        }}</Menu.Trigger>
      </template>
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
  <Menu.Trigger v-if="help" :handle payload="help" data-key="help">help</Menu.Trigger>
  <Menu.Root
    v-if="form === 'detached' || form === 'mixed'"
    v-slot="{ payload }"
    :handle
    v-bind="root"
  >
    <MenubarMenu
      v-if="payload"
      :menu="payload as string"
      :submenus
      :portal="portals[payload as string]"
      :positioner="positioners[payload as string]"
    />
  </Menu.Root>
  <input id="after" aria-label="After" />
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>
