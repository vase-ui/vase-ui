<script setup lang="ts">
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';

// A menu whose item is the trigger of a dialog, or of an alert dialog with `alert`. The item keeps
// the menu open at its press.
defineProps({ alert: Boolean });
</script>

<template>
  <Menu.Root>
    <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup data-testid="popup">
          <Menu.Item data-key="a">a</Menu.Item>
          <AlertDialog.Root v-if="alert">
            <AlertDialog.Trigger>
              <template #element="{ props, elementRef }">
                <Menu.Item v-bind="props" :ref="elementRef" :close-on-click="false" data-key="open">
                  Open
                </Menu.Item>
              </template>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop />
              <AlertDialog.Popup
                data-testid="dialog-popup"
                style="position: fixed; top: 300px; left: 300px"
              >
                <AlertDialog.Close data-testid="dialog-button">Close</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
          <Dialog.Root v-else>
            <Dialog.Trigger>
              <template #element="{ props, elementRef }">
                <Menu.Item v-bind="props" :ref="elementRef" :close-on-click="false" data-key="open">
                  Open
                </Menu.Item>
              </template>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup
                data-testid="dialog-popup"
                style="position: fixed; top: 300px; left: 300px"
              >
                <button data-testid="dialog-button">Inside</button>
                <button>Second</button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Menu.Item data-key="b">b</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
