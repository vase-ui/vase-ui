<script setup lang="ts">
import { shallowRef } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';
import type { DialogRootChangeEventDetails } from '../../src/dialog/types';

// A dialog with a text field. While the field has text, a close asks for a confirmation in an alert
// dialog, and the dialog stays open. The viewport has padding around the popup, and the fixed
// element of the dialog covers the rest of the view. With `backdrop`, a backdrop covers the view.
defineProps({ backdrop: Boolean });

const open = shallowRef(false);
const confirming = shallowRef(false);
const text = shallowRef('');

function onOpenChange(next: boolean, details: DialogRootChangeEventDetails) {
  if (next || !text.value) return;
  details.cancel();
  confirming.value = true;
}
</script>

<template>
  <Dialog.Root v-model:open="open" @open-change="onOpenChange">
    <Dialog.Trigger>Write</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop v-if="backdrop" data-testid="backdrop" style="position: fixed; inset: 0" />
      <Dialog.Viewport
        data-testid="viewport"
        style="position: fixed; left: 0; top: 0; width: 400px; height: 300px; padding: 60px"
      >
        <Dialog.Popup data-testid="popup">
          <textarea v-model="text" data-testid="text" aria-label="Text" />
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
    <AlertDialog.Root v-model:open="confirming">
      <AlertDialog.Portal>
        <AlertDialog.Popup data-testid="confirm" style="position: fixed; left: 500px; top: 0">
          <AlertDialog.Close data-testid="back">Go back</AlertDialog.Close>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </Dialog.Root>
</template>
