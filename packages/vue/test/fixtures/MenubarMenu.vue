<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// The portal of the menu `menu` of a bar, with two items. With `submenus`, the menu `file` has a
// submenu `share`, and the menu `view` has a submenu `layout` with a radio group.
defineProps({
  menu: { type: String, required: true },
  submenus: Boolean,
  portal: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
});
</script>

<template>
  <Menu.Portal v-bind="portal">
    <Menu.Positioner :data-testid="`${menu}-positioner`" v-bind="positioner">
      <Menu.Popup :data-testid="`${menu}-popup`">
        <Menu.Item :data-key="`${menu}-1`">{{ menu }} 1</Menu.Item>
        <Menu.Item :data-key="`${menu}-2`">{{ menu }} 2</Menu.Item>
        <Menu.SubmenuRoot v-if="submenus && menu === 'file'">
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
        <Menu.SubmenuRoot v-if="submenus && menu === 'view'">
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
</template>
