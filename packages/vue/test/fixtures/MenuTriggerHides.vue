<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef, watch } from 'vue';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';

// With `dialog`, a menu in an open dialog: its item hides the menu and its trigger. Else two menus:
// the item of the second one hides its trigger and shows an input that takes the focus.
defineProps({ dialog: Boolean });
const hidden = shallowRef(false);
const input = useTemplateRef<HTMLInputElement>('input');
watch(hidden, async (value) => {
  await nextTick();
  if (value) input.value?.focus();
});
</script>

<template>
  <Dialog.Root v-if="dialog" default-open>
    <Dialog.Trigger data-testid="dialog-trigger">Create</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup data-testid="dialog-popup" style="position: fixed; top: 300px; left: 300px">
        <div :hidden="hidden">
          <Menu.Root>
            <Menu.Trigger data-testid="trigger">Template</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Item data-key="blank" @click="hidden = true">Blank</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
  <div v-else>
    <Menu.Root>
      <Menu.Trigger data-testid="other">Other</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid="other-popup">
            <Menu.Item data-key="item">Item</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <input v-if="hidden" ref="input" aria-label="Name" />
    <Menu.Root>
      <Menu.Trigger data-testid="trigger" :hidden="hidden">Actions</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid="popup">
            <Menu.Item data-key="rename" @click="hidden = true">Rename</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </div>
</template>
