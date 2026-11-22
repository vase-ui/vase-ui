<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';
import { Select } from '../../src/select';

// By `variant`: a menu or a select in the popup of a dialog that its trigger `open` opens, or a
// dialog that an item of a menu opens and that stays in the menu.
defineProps({
  variant: {
    type: String as PropType<'menu in dialog' | 'select in dialog' | 'dialog in menu'>,
    required: true,
  },
});
</script>

<template>
  <Menu.Root v-if="variant === 'dialog in menu'">
    <Menu.Trigger data-testid="menu-trigger">Menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup data-testid="menu">
          <Dialog.Root>
            <Dialog.Trigger :as="Menu.Item" :close-on-click="false" data-testid="open">
              Open dialog
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup">
                <Dialog.Close>Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <Dialog.Root v-else>
    <Dialog.Trigger data-testid="open">Open</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup data-testid="popup" style="position: fixed; left: 200px; top: 100px">
        <Menu.Root v-if="variant === 'menu in dialog'">
          <Menu.Trigger data-testid="inner-trigger">Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="inner">
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Select.Root v-else>
          <Select.Trigger data-testid="inner-trigger">
            <Select.Value placeholder="Open select" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner :align-item-with-trigger="false">
              <Select.Popup data-testid="inner">
                <Select.Item value="a">Item</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
