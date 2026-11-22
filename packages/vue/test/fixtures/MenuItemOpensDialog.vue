<script setup lang="ts">
import { ref, type PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// A menu whose item opens a dialog of its own, outside the menu: an alert dialog with `alert`,
// else a dialog with a backdrop over the view. A button stands before the trigger.
defineProps({ alert: Boolean, portal: Object as PropType<Props> });
const dialogOpen = ref(false);
const changes = ref<string[]>([]);
defineExpose({ changes });
</script>

<template>
  <button id="before">Before</button>
  <Menu.Root>
    <Menu.Trigger data-testid="trigger">Playlist</Menu.Trigger>
    <Menu.Portal v-bind="portal">
      <Menu.Positioner>
        <Menu.Popup data-testid="popup">
          <Menu.Item data-key="open" @click="dialogOpen = true">Open dialog</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
  <AlertDialog.Root v-if="alert" v-model:open="dialogOpen">
    <AlertDialog.Portal>
      <AlertDialog.Popup data-testid="dialog-popup">
        <AlertDialog.Close data-testid="dialog-button">Cancel</AlertDialog.Close>
      </AlertDialog.Popup>
    </AlertDialog.Portal>
  </AlertDialog.Root>
  <Dialog.Root
    v-else
    v-model:open="dialogOpen"
    @open-change="
      (open: boolean, details: { reason: string }) => changes.push(`${open} ${details.reason}`)
    "
  >
    <Dialog.Portal>
      <Dialog.Backdrop style="position: fixed; inset: 0" />
      <Dialog.Popup data-testid="dialog-popup">Dialog</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
