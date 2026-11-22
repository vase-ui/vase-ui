<script setup lang="ts">
import { shallowRef, type PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { Select } from '../../src/select';

// A dialog that an item of a select or of a menu opens. With `detachedTrigger`, the item of the menu
// is a trigger of the dialog with a handle. The trigger of the select or the menu is
// `source-trigger`. `keepMountedMenu` keeps the closed menu in the DOM, `keepMountedDialog` keeps the
// closed dialog in the DOM, and `pressKeepsFocus` stops the press on the menu trigger from moving the
// focus to it, as Safari and Firefox on macOS do for a button.
defineProps({
  source: { type: String as PropType<'select' | 'menu'>, required: true },
  keepMountedMenu: Boolean,
  keepMountedDialog: Boolean,
  pressKeepsFocus: Boolean,
  detachedTrigger: Boolean,
});
const open = shallowRef(false);
const handle = Dialog.createHandle();
</script>

<template>
  <Select.Root v-if="source === 'select'">
    <Select.Trigger data-testid="source-trigger">
      <Select.Value placeholder="Select" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner>
        <Select.Popup>
          <Select.Item value="custom" @click="open = true">Custom</Select.Item>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
  <Menu.Root v-else>
    <Menu.Trigger
      data-testid="source-trigger"
      @mousedown="pressKeepsFocus && $event.preventDefault()"
    >
      Menu
    </Menu.Trigger>
    <Menu.Portal :keep-mounted="keepMountedMenu">
      <Menu.Positioner>
        <Menu.Popup>
          <Menu.Item v-if="detachedTrigger">
            <template #element="{ props: item, elementRef }">
              <Dialog.Trigger :ref="elementRef" :handle="handle" v-bind="item"
                >Custom</Dialog.Trigger
              >
            </template>
          </Menu.Item>
          <Menu.Item v-else @click="open = true">Custom</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Dialog.Root v-model:open="open" :handle="handle">
    <Dialog.Portal :keep-mounted="keepMountedDialog">
      <Dialog.Popup data-testid="popup">
        <Dialog.Close data-testid="close">Close</Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
